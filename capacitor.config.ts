import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wanxiang.chat',
  appName: '万象Chat',
  webDir: 'release/app/dist/renderer',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#007DFF',
    },
  },
  android: {
    buildOptions: {
      keystorePath: process.env.ANDROID_KEYSTORE_PATH || undefined,
      keystoreAlias: process.env.ANDROID_KEYSTORE_ALIAS || 'wanxiang',
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD || undefined,
      keystoreKeyPassword: process.env.ANDROID_KEYSTORE_KEY_PASSWORD || undefined,
    },
  },
}

export default config
