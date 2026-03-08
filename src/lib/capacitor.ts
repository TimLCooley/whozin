import { Capacitor } from '@capacitor/core'

/** True when running inside a native iOS/Android shell */
export const isNative = () => Capacitor.isNativePlatform()

/** Returns 'ios' | 'android' | 'web' */
export const getPlatform = () => Capacitor.getPlatform()
