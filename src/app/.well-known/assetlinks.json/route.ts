import { NextResponse } from 'next/server'

export async function GET() {
  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'io.whozin.app',
        sha256_cert_fingerprints: [
          // TODO: Add your signing certificate SHA-256 fingerprint
          // Run: keytool -list -v -keystore your-keystore.jks | grep SHA256
        ],
      },
    },
  ]

  return NextResponse.json(assetlinks, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
