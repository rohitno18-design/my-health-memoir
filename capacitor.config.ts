import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.imsmrti.health',
  appName: 'I M Smrti',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
