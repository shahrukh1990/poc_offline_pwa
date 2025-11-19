'use client';

import { OfflineQueueProvider } from '@/contexts/offline-queue-context';
import { Toaster } from '@/components/ui/toaster';

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <OfflineQueueProvider>
      {children}
      <Toaster />
    </OfflineQueueProvider>
  );
}
