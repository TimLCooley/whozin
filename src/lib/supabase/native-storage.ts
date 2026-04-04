import { Preferences } from '@capacitor/preferences'

/**
 * Custom storage adapter using Capacitor Preferences (SharedPreferences on Android,
 * UserDefaults on iOS). This persists reliably across app restarts, unlike
 * localStorage which can be cleared by Android WebView in remote URL mode.
 */
export const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value })
  },
  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key })
  },
}
