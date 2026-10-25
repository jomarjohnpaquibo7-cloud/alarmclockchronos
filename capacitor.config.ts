import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chronos.alarmclock',
  appName: 'Chronos Alarm',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
