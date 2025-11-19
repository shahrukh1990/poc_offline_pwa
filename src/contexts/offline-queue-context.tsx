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
import {
  db,
  initDb,
  getSubmissions,
  addOrUpdateSubmission,
} from '@/lib/sqlite-service';
import { Capacitor } from '@capacitor/core';
import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';

const MAX_RETRIES = 5;

type State = {
  submissions: Submission[];
  isSyncing: boolean;
  isDbInitialized: boolean;
};

type Action =
  | { type: 'LOAD_QUEUE'; payload: Submission[] }
  | { type: 'ADD_SUBMISSION'; payload: Submission }
  | { type: 'START_SYNC' }
  | { type: 'END_SYNC' }
  | { type: 'UPDATE_SUBMISSION'; payload: Partial<Submission> & { id: string } }
  | { type: 'DB_INITIALIZED' };

const initialState: State = {
  submissions: [],
  isSyncing: false,
  isDbInitialized: false,
};

// Define jeep-sqlite custom element
if (Capacitor.getPlatform() === 'web') {
  try {
    customElements.define('jeep-sqlite', JeepSqlite);
  } catch (e) {
    console.warn('jeep-sqlite already defined');
  }
}

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
    case 'DB_INITIALIZED':
      return { ...state, isDbInitialized: true };
    default:
      return state;
  }
}

interface OfflineQueueContextType {
  submissions: Submission[];
  isSyncing: boolean;
  isDbInitialized: boolean;
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
    const initializeDatabase = async () => {
      try {
        await initDb();
        dispatch({ type: 'DB_INITIALIZED' });
        const subs = await getSubmissions();
        dispatch({ type: 'LOAD_QUEUE', payload: subs });
      } catch (error) {
        console.error('Failed to initialize database:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description:
            'Could not initialize local storage. Offline mode may not work.',
        });
      }
    };
    initializeDatabase();
  }, [toast]);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncingRef.current || !state.isDbInitialized) {
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

    for (const item of itemsToSync) {
      const updatedItem: Submission = { ...item, status: 'sending' };
      dispatch({
        type: 'UPDATE_SUBMISSION',
        payload: { id: item.id, status: 'sending' },
      });
      await addOrUpdateSubmission(updatedItem);

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.formData),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText}`);
        }
        
        const finalItem: Submission = { ...updatedItem, status: 'sent' };
        dispatch({
          type: 'UPDATE_SUBMISSION',
          payload: { id: item.id, status: 'sent' },
        });
        await addOrUpdateSubmission(finalItem);

      } catch (error) {
        console.error(`Failed to submit item ${item.id}:`, error);
        const newAttempts = item.attempts + 1;
        let failedItem: Submission;

        if (newAttempts >= MAX_RETRIES) {
          failedItem = {
            ...updatedItem,
            status: 'failed',
            attempts: newAttempts,
          };
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
          failedItem = {
            ...updatedItem,
            status: 'pending',
            attempts: newAttempts,
            nextAttemptAt,
          };
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
        await addOrUpdateSubmission(failedItem);
      }
    }

    const newSentCount = itemsToSync.filter(
      (item) => state.submissions.find((s) => s.id === item.id)?.status === 'sent'
    ).length;

    if (newSentCount > 0) {
      toast({
        title: 'Sync Complete',
        description: `${newSentCount} submissions sent successfully.`,
      });
    }

    dispatch({ type: 'END_SYNC' });
  }, [isOnline, state.submissions, toast, state.isDbInitialized]);

  useEffect(() => {
    if (isOnline && state.isDbInitialized) {
      syncQueue();
    }
  }, [isOnline, syncQueue, state.isDbInitialized]);

  const addSubmission = async (formData: MaintenanceRequest) => {
    if (!state.isDbInitialized) {
      toast({
        variant: 'destructive',
        title: 'Database not ready',
        description: 'Please wait a moment and try again.',
      });
      return;
    }
    const newSubmission: Submission = {
      id: new Date().toISOString(),
      formData,
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_SUBMISSION', payload: newSubmission });
    await addOrUpdateSubmission(newSubmission);
    toast({
      title: 'Submission Queued',
      description: 'Your request has been saved and will be sent when online.',
    });
    if (isOnline) {
      syncQueue();
    }
  };

  const retrySubmission = async (id: string) => {
    const item = state.submissions.find(s => s.id === id);
    if (!item || !state.isDbInitialized) return;

    const updatedItem = {
      ...item,
      status: 'pending' as const,
      attempts: 0,
      nextAttemptAt: Date.now(),
    };
    dispatch({
      type: 'UPDATE_SUBMISSION',
      payload: updatedItem,
    });
    await addOrUpdateSubmission(updatedItem);
    if (isOnline) {
      syncQueue();
    }
  };

  const updateSubmissionData = async (
    id: string,
    formData: MaintenanceRequest
  ) => {
    const item = state.submissions.find(s => s.id === id);
    if (!item || !state.isDbInitialized) return;

    const updatedItem = { ...item, formData };
    dispatch({
      type: 'UPDATE_SUBMISSION',
      payload: { id, formData },
    });
    await addOrUpdateSubmission(updatedItem);
    toast({
      title: 'Submission Updated',
      description: 'The submission data has been updated based on AI suggestion.',
    });
  };

  const value = {
    submissions: state.submissions,
    isSyncing: state.isSyncing,
    isDbInitialized: state.isDbInitialized,
    addSubmission,
    retrySubmission,
    updateSubmissionData,
  };

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
      {Capacitor.getPlatform() === 'web' && <jeep-sqlite></jeep-sqlite>}
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
