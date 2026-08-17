import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Host-saved locations: reusable {name, address} places for the current user.

async function currentUserId() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  return data?.id ?? null
}

// GET — list the current user's saved locations
export async function GET() {
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = getAdminClient()
  const { data } = await admin
    .from('whozin_saved_locations')
    .select('id, name, address')
    .eq('user_id', uid)
    .order('name', { ascending: true })
  return NextResponse.json(data ?? [])
}

// POST — save (or update) a location. Body: { name, address? }
export async function POST(req: NextRequest) {
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, address } = await req.json()
  const trimmedName = (name ?? '').trim()
  if (!trimmedName) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  const trimmedAddress = (address ?? '').trim() || null

  const admin = getAdminClient()
  // Re-saving the same name (case-insensitive) just updates the address.
  const { data: existing } = await admin
    .from('whozin_saved_locations')
    .select('id')
    .eq('user_id', uid)
    .ilike('name', trimmedName)
    .maybeSingle()

  if (existing) {
    const { data, error } = await admin
      .from('whozin_saved_locations')
      .update({ name: trimmedName, address: trimmedAddress })
      .eq('id', existing.id)
      .select('id, name, address')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await admin
    .from('whozin_saved_locations')
    .insert({ user_id: uid, name: trimmedName, address: trimmedAddress })
    .select('id, name, address')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove a saved location. Body: { id }
export async function DELETE(req: NextRequest) {
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const admin = getAdminClient()
  const { error } = await admin
    .from('whozin_saved_locations')
    .delete()
    .eq('id', id)
    .eq('user_id', uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
