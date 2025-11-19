'use client';

import { useEffect, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useOfflineQueue } from '@/contexts/offline-queue-context';
import { useToast } from '@/hooks/use-toast';
import { initDb } from '@/lib/sqlite-service';

// Dynamically import jeep-sqlite only on the web platform
if (Capacitor.getPlatform() === 'web') {
  import('jeep-sqlite/dist/components/jeep-sqlite').then(module => {
     const JeepSqlite = module.JeepSqlite;
      try {
        if (!customElements.get('jeep-sqlite')) {
          customElements.define('jeep-sqlite', JeepSqlite);
        }
      } catch (e) {
        console.warn('jeep-sqlite already defined');
      }
  });
}

const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const { setDbInitialized, loadSubmissionsFromDb, isDbInitialized } = useOfflineQueue();
  const { toast } = useToast();

  useEffect(() => {
    if (isDbInitialized) return;

    const initializeDatabase = async () => {
      try {
        await initDb();
        setDbInitialized(true);
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
  }, [isDbInitialized, setDbInitialized, toast]);

  useEffect(() => {
    if (isDbInitialized) {
      loadSubmissionsFromDb();
    }
  }, [isDbInitialized, loadSubmissionsFromDb]);


  return (
    <>
      {children}
      {Capacitor.getPlatform() === 'web' && <jeep-sqlite></jeep-sqlite>}
    </>
  );
};

export default DatabaseProvider;
