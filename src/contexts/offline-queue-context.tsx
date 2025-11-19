'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { Submission, MaintenanceRequest } from '@/lib/types';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useToast } from '@/hooks/use-toast';

const QUEUE_STORAGE_KEY = 'offline-submission-queue';
const MAX_RETRIES = 5;

type State = {
  submissions: Submission[];
  isSyncing: boolean;
};

type Action =
  | { type: 'LOAD_QUEUE'; payload: Submission[] }
  | { type: 'ADD_SUBMISSION'; payload: Submission }
  | { type: 'START_SYNC' }
  | { type: 'END_SYNC' }
  | { type: 'UPDATE_SUBMISSION'; payload: Partial<Submission> & { id: string } };

const initialState: State = {
  submissions: [],
  isSyncing: false,
};

function queueReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_QUEUE':
      return { ...state, submissions: action.payload };
    case 'ADD_SUBMISSION':
      return {
        ...state,
        submissions: [action.payload, ...state.submissions],
      };
    case 'START_SYNC':
      return { ...state, isSyncing: true };
    case 'END_SYNC':
      return { ...state, isSyncing: false };
    case 'UPDATE_SUBMISSION': {
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    }
    default:
      return state;
  }
}

interface OfflineQueueContextType {
  submissions: Submission[];
  isSyncing: boolean;
  addSubmission: (formData: MaintenanceRequest) => void;
  retrySubmission: (id: string) => void;
  updateSubmissionData: (id: string, formData: MaintenanceRequest) => void;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(
  undefined
);

export function OfflineQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(queueReducer, initialState);
  const isOnline = useNetworkStatus();
  const { toast } = useToast();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    isSyncingRef.current = state.isSyncing;
  }, [state.isSyncing]);

  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (storedQueue) {
        const parsedQueue = JSON.parse(storedQueue) as Submission[];
        dispatch({ type: 'LOAD_QUEUE', payload: parsedQueue });
      }
    } catch (error) {
      console.error('Failed to load submission queue from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(state.submissions)
      );
    } catch (error) {
      console.error('Failed to save submission queue to localStorage:', error);
    }
  }, [state.submissions]);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncingRef.current) {
      return;
    }

    dispatch({ type: 'START_SYNC' });
    toast({
      title: 'Syncing...',
      description: 'Attempting to send offline submissions.',
    });

    const itemsToSync = state.submissions.filter(
      (s) =>
        (s.status === 'pending' ||
          (s.status === 'failed' && s.attempts < MAX_RETRIES)) &&
        (!s.nextAttemptAt || Date.now() >= s.nextAttemptAt)
    );

    if (itemsToSync.length === 0) {
      dispatch({ type: 'END_SYNC' });
      return;
    }

    const syncPromises = itemsToSync.map(async (item) => {
      dispatch({
        type: 'UPDATE_SUBMISSION',
        payload: { id: item.id, status: 'sending' },
      });
      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.formData),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText}`);
        }

        dispatch({
          type: 'UPDATE_SUBMISSION',
          payload: { id: item.id, status: 'sent' },
        });
      } catch (error) {
        console.error(`Failed to submit item ${item.id}:`, error);
        const newAttempts = item.attempts + 1;

        if (newAttempts >= MAX_RETRIES) {
          dispatch({
            type: 'UPDATE_SUBMISSION',
            payload: {
              id: item.id,
              status: 'failed',
              attempts: newAttempts,
            },
          });
        } else {
          const delay = 1000 * Math.pow(2, newAttempts - 1);
          const nextAttemptAt = Date.now() + delay;
          dispatch({
            type: 'UPDATE_SUBMISSION',
            payload: {
              id: item.id,
              status: 'pending',
              attempts: newAttempts,
              nextAttemptAt,
            },
          });
        }
      }
    });

    await Promise.allSettled(syncPromises);

    const newSentCount = state.submissions.filter(
      (s) => itemsToSync.some((i) => i.id === s.id) && s.status === 'sent'
    ).length;
    if (newSentCount > 0) {
      toast({
        title: 'Sync Complete',
        description: `${newSentCount} submissions sent successfully.`,
      });
    }

    dispatch({ type: 'END_SYNC' });
  }, [isOnline, state.submissions, toast]);

  useEffect(() => {
    if (isOnline) {
      syncQueue();
    }
  }, [isOnline, syncQueue]);

  const addSubmission = (formData: MaintenanceRequest) => {
    const newSubmission: Submission = {
      id: new Date().toISOString(),
      formData,
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_SUBMISSION', payload: newSubmission });
    toast({
      title: 'Submission Queued',
      description: 'Your request has been saved and will be sent when online.',
    });
    if (isOnline) {
      syncQueue();
    }
  };

  const retrySubmission = (id: string) => {
    dispatch({
      type: 'UPDATE_SUBMISSION',
      payload: { id, status: 'pending', attempts: 0, nextAttemptAt: Date.now() },
    });
    if (isOnline) {
      syncQueue();
    }
  };
  
  const updateSubmissionData = (id: string, formData: MaintenanceRequest) => {
    dispatch({
      type: 'UPDATE_SUBMISSION',
      payload: { id, formData },
    });
     toast({
      title: 'Submission Updated',
      description: 'The submission data has been updated based on AI suggestion.',
    });
  };

  const value = {
    submissions: state.submissions,
    isSyncing: state.isSyncing,
    addSubmission,
    retrySubmission,
    updateSubmissionData,
  };

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);
  if (context === undefined) {
    throw new Error(
      'useOfflineQueue must be used within an OfflineQueueProvider'
    );
  }
  return context;
}
