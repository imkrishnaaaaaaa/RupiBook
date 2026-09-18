import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rupibook.app',
  appName: 'RupiBook',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0c11',
      showSpinner: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_rupibook',
      iconColor: '#2ce0a7'
    },
    CapacitorBiometricAuth: {
      iosKeychainGroup: 'com.rupibook.app'
    }
  }
};

export default config;