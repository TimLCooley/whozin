import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chumem.whozin',
  appName: 'Whozin',
  webDir: 'out',
  server: {
    url: 'https://whozin.io',
    cleartext: false,
  },
  ios: {
    scheme: 'Whozin',
  },
}

export default config
