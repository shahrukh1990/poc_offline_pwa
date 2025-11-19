import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.offlineforms',
  appName: 'OfflineForms',
  webDir: 'out',
  server: {
    hostname: 'localhost',
    iosScheme: 'https',
    androidScheme: 'https',
  },
};

export default config;
