import admin from 'firebase-admin'

let app: admin.app.App | null = null

export function getFirebaseAdmin(): admin.app.App {
  if (app) return app

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials not configured')
  }

  if (!admin.apps.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  } else {
    app = admin.apps[0]!
  }

  return app
}
