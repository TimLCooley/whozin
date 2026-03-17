import { NextRequest, NextResponse } from 'next/server'

// Called by Vercel Cron daily to refresh integration health checks
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Call the health check endpoint internally
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://whozin.io'
  try {
    const res = await fetch(`${baseUrl}/api/admin/health-check`)
    const data = await res.json()
    return NextResponse.json({ ok: true, ...data })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
