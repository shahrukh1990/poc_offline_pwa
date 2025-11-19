
// src/contexts/offline-queue-context.tsx
'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import type { Submission, MaintenanceRequest } from '@/lib/types';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useToast } from '@/hooks/use-toast';
import * as storage from '@/lib/storage-service';
import type { StorageService } from '@/lib/storage-service.interface';

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
  isStorageInitialized: boolean;
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
  const [isStorageInitialized, setStorageInitialized] = useState(false);
  const isOnline = useNetworkStatus();
  const { toast } = useToast();
  const isSyncingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    isSyncingRef.current = state.isSyncing;
  }, [state.isSyncing]);

  const loadInitialData = useCallback(async () => {
    try {
      await storage.init();
      const subs = await storage.getSubmissions();
      dispatch({ type: 'LOAD_QUEUE', payload: subs });
      setStorageInitialized(true);
    } catch (error) {
      console.error('Failed to initialize storage and load data:', error);
      toast({
        variant: 'destructive',
        title: 'Storage Error',
        description: 'Could not load saved data. Offline features may not work.',
      });
      setStorageInitialized(true); // Still allow app to run
    }
  }, [toast]);

  useEffect(() => {
    if (!isStorageInitialized) {
      loadInitialData();
    }
  }, [isStorageInitialized, loadInitialData]);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncingRef.current || !isStorageInitialized) {
      return;
    }

    dispatch({ type: 'START_SYNC' });

    const getSubmissions = () => stateRef.current.submissions;

    const itemsToSync = getSubmissions().filter(
      (s) =>
        (s.status === 'pending' ||
          (s.status === 'failed' && s.attempts < MAX_RETRIES)) &&
        (!s.nextAttemptAt || Date.now() >= s.nextAttemptAt)
    );

    if (itemsToSync.length === 0) {
      dispatch({ type: 'END_SYNC' });
      return;
    }

    toast({
      title: 'Syncing...',
      description: `Attempting to send ${itemsToSync.length} offline submission(s).`,
    });

    for (const item of itemsToSync) {
      const updatedItem: Submission = { ...item, status: 'sending' };
      dispatch({
        type: 'UPDATE_SUBMISSION',
        payload: { id: item.id, status: 'sending' },
      });
      await storage.addOrUpdateSubmission(updatedItem);

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
        await storage.addOrUpdateSubmission(finalItem);
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
        await storage.addOrUpdateSubmission(failedItem);
      }
    }

    const successfulSyncs = itemsToSync.filter(
      (i) =>
        getSubmissions().find((s) => s.id === i.id)?.status === 'sent'
    ).length;

    if (successfulSyncs > 0) {
      toast({
        title: 'Sync Complete',
        description: `${successfulSyncs} submission(s) sent successfully.`,
      });
    }

    dispatch({ type: 'END_SYNC' });
  }, [isOnline, toast, isStorageInitialized]);

  useEffect(() => {
    if (isOnline && isStorageInitialized) {
      const timer = setTimeout(() => syncQueue(), 1000); // Small delay to allow state to settle
      return () => clearTimeout(timer);
    }
  }, [isOnline, isStorageInitialized, syncQueue]);

  const addSubmission = useCallback(async (formData: MaintenanceRequest) => {
    if (!isStorageInitialized) {
      toast({
        variant: 'destructive',
        title: 'Storage not ready',
        description: 'Please wait a moment and try again.',
      });
      return;
    }
    const newSubmission: Submission = {
      id: crypto.randomUUID(),
      formData,
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_SUBMISSION', payload: newSubmission });
    await storage.addOrUpdateSubmission(newSubmission);
    toast({
      title: 'Submission Queued',
      description: 'Your request has been saved and will be sent when online.',
    });
    // Trigger sync immediately if online
    if (isOnline) {
      // Use a timeout to ensure state has updated before syncing
      setTimeout(() => syncQueue(), 50);
    }
  }, [isStorageInitialized, isOnline, toast, syncQueue]);

  const retrySubmission = useCallback(async (id: string) => {
    const item = stateRef.current.submissions.find((s) => s.id === id);
    if (!item || !isStorageInitialized) return;

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
    await storage.addOrUpdateSubmission(updatedItem);
    if (isOnline) {
      setTimeout(() => syncQueue(), 50);
    }
  }, [isStorageInitialized, isOnline, syncQueue]);

  const updateSubmissionData = async (
    id: string,
    formData: MaintenanceRequest
  ) => {
    const item = stateRef.current.submissions.find((s) => s.id === id);
    if (!item || !isStorageInitialized) return;

    const updatedItem = { ...item, formData };
    dispatch({
      type: 'UPDATE_SUBMISSION',
      payload: { id, formData },
    });
    await storage.addOrUpdateSubmission(updatedItem);
    toast({
      title: 'Submission Updated',
      description:
        'The submission data has been updated based on AI suggestion.',
    });
  };

  const value = {
    submissions: state.submissions,
    isSyncing: state.isSyncing,
    isStorageInitialized,
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
