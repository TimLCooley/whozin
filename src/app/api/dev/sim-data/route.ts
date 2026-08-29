import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Dev-only: persists calibration-match rounds to disk so Claude can read the
// human's ground-truth placements directly (no copy-paste export needed).
const FILE = path.join(process.cwd(), '.dev-sim', 'corrections.json')

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  try {
    const body = await req.json()
    await fs.mkdir(path.dirname(FILE), { recursive: true })
    await fs.writeFile(FILE, JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    return new NextResponse(raw, { headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({})
  }
}
