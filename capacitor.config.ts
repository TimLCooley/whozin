import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.whozin.app',
  appName: 'Whozin',
  webDir: 'out',
  server: {
    url: 'https://whozin.io',
    cleartext: false,
    allowNavigation: [
      'ooqdkonjcztjankkvejh.supabase.co',
      '*.apple.com',
      'accounts.google.com',
    ],
  },
  ios: {
    scheme: 'Whozin',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['email', 'profile', 'https://www.googleapis.com/auth/contacts.readonly'],
      serverClientId: '85647149825-ppb9jgfq3umjv47s4rlbr4paj0ns4lbq.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
}

export default config
