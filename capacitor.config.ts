import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chronos.alarmclock',
  appName: 'Chronos Alarm',
  webDir: 'dist',
  server: {
    url: 'https://chronos-alarm-schedule-manager-ampjst.v2.appdeploy.ai/',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
