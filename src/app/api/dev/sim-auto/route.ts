import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import path from 'path'

// Dev-only: full-auto setup calibration — Claude's algorithm reads the court from
// scratch (no seed corners). The sim freezes the result as "Claude's read" and
// Tim's corrections grade it.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  const body = await req.json()
  const script = path.join(process.cwd(), 'dev-cv', 'auto_api.py')
  const out = await new Promise<string>((resolve, reject) => {
    const p = execFile('python3', [script], { cwd: path.dirname(script), timeout: 60000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)))
    p.stdin?.write(JSON.stringify(body))
    p.stdin?.end()
  }).catch((e) => JSON.stringify({ error: String(e) }))
  try {
    return NextResponse.json(JSON.parse(out.trim()))
  } catch {
    return NextResponse.json({ error: 'auto-calibration failed' }, { status: 500 })
  }
}
