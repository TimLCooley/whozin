import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import path from 'path'

// Dev-only: runs the CV snap (rough corners -> polished onto the painted lines)
// via the dev-cv Python toolkit. This is the tap+snap product flow, playable
// from the sim so we can test it with human eyes before porting it for real.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  const body = await req.json()
  const script = path.join(process.cwd(), 'dev-cv', 'snap_api.py')
  const out = await new Promise<string>((resolve, reject) => {
    const p = execFile('python3', [script], { cwd: path.dirname(script), timeout: 30000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)))
    p.stdin?.write(JSON.stringify(body))
    p.stdin?.end()
  }).catch((e) => JSON.stringify({ error: String(e) }))
  try {
    return NextResponse.json(JSON.parse(out.trim()))
  } catch {
    return NextResponse.json({ error: 'snap failed' }, { status: 500 })
  }
}
