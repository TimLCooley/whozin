import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import path from 'path'

// Dev-only: receive a live capture (base64 jpeg, downscaled client-side) and
// store it under public/sim/live/ so the sim can calibrate real courtside shots.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const b64 = String(body?.data ?? '').split(',').pop() ?? ''
    const buf = Buffer.from(b64, 'base64')
    if (buf.length < 1000 || buf.length > 8_000_000) {
      return NextResponse.json({ error: 'bad image size' }, { status: 400 })
    }
    const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex')
    const dir = path.join(process.cwd(), 'public', 'sim', 'live')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, `${id}.jpg`), buf)
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
