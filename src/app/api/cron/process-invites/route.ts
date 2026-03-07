import { NextRequest, NextResponse } from 'next/server'
import { processAllPendingInvites } from '@/lib/invite-processor'

// Called by Vercel Cron every minute to process expired invite timers
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await processAllPendingInvites()

  return NextResponse.json({ ok: true, processed: results.length, results })
}
