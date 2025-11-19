'use client';

import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  // Default to true, will be corrected by useEffect on the client
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // This effect runs only on the client after hydration
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
