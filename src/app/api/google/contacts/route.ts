import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the Google provider token from the user's session
  const { data: { session } } = await supabase.auth.getSession()
  const providerToken = session?.provider_token

  if (!providerToken) {
    return NextResponse.json({ error: 'no_google_token', message: 'Not signed in with Google or token expired' }, { status: 401 })
  }

  const query = req.nextUrl.searchParams.get('q') || ''

  try {
    let url: string
    if (query.trim()) {
      // Search contacts
      url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query)}&readMask=names,phoneNumbers,emailAddresses,photos&pageSize=20`
    } else {
      // List contacts (sorted by last updated)
      url = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,photos&pageSize=50&sortOrder=LAST_NAME_ASCENDING`
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${providerToken}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 401) {
        return NextResponse.json({ error: 'no_google_token', message: 'Google token expired. Please sign in again.' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch contacts', details: err }, { status: res.status })
    }

    const data = await res.json()
    const people = data.results || data.connections || []

    const contacts = people
      .map((entry: { person?: Record<string, unknown> } & Record<string, unknown>) => {
        const person = entry.person || entry
        const names = person.names as Array<{ displayName?: string; givenName?: string; familyName?: string }> | undefined
        const phones = person.phoneNumbers as Array<{ value?: string }> | undefined
        const emails = person.emailAddresses as Array<{ value?: string }> | undefined
        const photos = person.photos as Array<{ url?: string }> | undefined

        const name = names?.[0]
        const phone = phones?.[0]?.value || ''
        const email = emails?.[0]?.value || ''
        const photo = photos?.[0]?.url || ''

        if (!name?.displayName && !phone) return null

        return {
          name: name?.displayName || '',
          first_name: name?.givenName || '',
          last_name: name?.familyName || '',
          phone: phone.replace(/[\s\-().]/g, ''),
          email,
          photo,
        }
      })
      .filter(Boolean)

    return NextResponse.json(contacts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Google contacts' }, { status: 500 })
  }
}
