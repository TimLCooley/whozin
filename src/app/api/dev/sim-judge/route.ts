import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import path from 'path'

// Dev-only: the CV referee judges a placement against the actual painted lines
// and returns the verdict the product's confidence gate would give. Tim rules
// the same placement by eye; misalignment between the two = the gate is wrong.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }
  const body = await req.json()
  const script = path.join(process.cwd(), 'dev-cv', 'judge_api.py')
  const out = await new Promise<string>((resolve, reject) => {
    const p = execFile('python3', [script], { cwd: path.dirname(script), timeout: 30000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)))
    p.stdin?.write(JSON.stringify(body))
    p.stdin?.end()
  }).catch((e) => JSON.stringify({ error: String(e) }))
  try {
    return NextResponse.json(JSON.parse(out.trim()))
  } catch {
    return NextResponse.json({ error: 'judge failed' }, { status: 500 })
  }
}
