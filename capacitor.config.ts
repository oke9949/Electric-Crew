import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'hu.electriccrew.app',
  appName: 'Electric Crew',
  webDir: 'dist',
  server: {
    url: 'https://electric-crew-app.vercel.app',
    cleartext: false,
  },
};

export default config;
