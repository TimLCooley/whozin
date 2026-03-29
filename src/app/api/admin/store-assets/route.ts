import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

// GET — return all store asset URLs organized by platform for CI/CD
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.WHOZIN_BUILD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const { data: settings } = await admin
    .from('whozin_settings')
    .select('key, value')

  if (!settings) {
    return NextResponse.json({ error: 'No settings found' }, { status: 404 })
  }

  const all: Record<string, string> = {}
  for (const s of settings) {
    if (s.key.startsWith('store_') && s.value) {
      // Strip JSON quotes if present
      const val = typeof s.value === 'string' ? s.value.replace(/^"|"$/g, '') : String(s.value)
      if (val) all[s.key] = val
    }
  }

  // Organize for iOS fastlane deliver
  const ios = {
    icon: all.store_ios_icon || null,
    screenshots: {
      // 6.7" → iPhone 15 Pro Max display
      'APP_IPHONE_67': [
        all.store_ios_67_1, all.store_ios_67_2, all.store_ios_67_3,
        all.store_ios_67_4, all.store_ios_67_5, all.store_ios_67_6,
      ].filter(Boolean),
      // 6.5" → iPhone 11 Pro Max display
      'APP_IPHONE_65': [
        all.store_ios_65_1, all.store_ios_65_2, all.store_ios_65_3,
      ].filter(Boolean),
      // 5.5" → iPhone 8 Plus display
      'APP_IPHONE_55': [
        all.store_ios_55_1, all.store_ios_55_2,
      ].filter(Boolean),
      // iPad 12.9"
      'APP_IPAD_PRO_129': [
        all.store_ios_ipad_1, all.store_ios_ipad_2,
      ].filter(Boolean),
    },
  }

  // Organize for Google Play
  const android = {
    icon: all.store_android_icon || null,
    featureGraphic: all.store_android_feature || null,
    phoneScreenshots: [
      all.store_android_phone_1, all.store_android_phone_2, all.store_android_phone_3,
      all.store_android_phone_4, all.store_android_phone_5, all.store_android_phone_6,
      all.store_android_phone_7, all.store_android_phone_8,
    ].filter(Boolean),
    tablet7Screenshots: [
      all.store_android_tablet_7_1, all.store_android_tablet_7_2,
    ].filter(Boolean),
    tablet10Screenshots: [
      all.store_android_tablet_10_1, all.store_android_tablet_10_2,
    ].filter(Boolean),
  }

  return NextResponse.json({ ios, android })
}
