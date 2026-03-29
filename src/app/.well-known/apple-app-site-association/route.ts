import { NextResponse } from 'next/server'

export async function GET() {
  const association = {
    applinks: {
      apps: [],
      details: [
        {
          appID: '3QM6SDB8NG.io.whozin.app',
          paths: ['/dl', '/dl/*', '/u/*'],
        },
      ],
    },
  }

  return NextResponse.json(association, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
