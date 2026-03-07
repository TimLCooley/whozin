export interface WhozinUser {
  id: string
  auth_user_id: string
  phone: string
  country_code: string
  first_name: string
  last_name: string
  email: string | null
  avatar_url: string | null
  status: 'active' | 'invited'
  membership_tier: 'free' | 'pro'
  push_notifications_enabled: boolean
  text_notifications_enabled: boolean
  hide_from_invites: boolean
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Group {
  id: string
  organization_id: string
  creator_id: string
  name: string
  chat_enabled: boolean
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  priority_order: number
  created_at: string
}

export interface Activity {
  id: string
  creator_id: string
  group_id: string
  activity_type: string
  activity_name: string
  activity_date: string | null
  activity_time: string | null
  location: string | null
  cost: number | null
  max_capacity: number | null
  capacity_current: number
  response_timer_minutes: number | null
  status: 'open' | 'full' | 'past' | 'cancelled'
  chat_enabled: boolean
  created_at: string
  updated_at: string
}

export interface ActivityMember {
  id: string
  activity_id: string
  user_id: string
  status: 'confirmed' | 'tbd' | 'waiting' | 'out' | 'missed'
  priority_order: number
  responded_at: string | null
  created_at: string
}

export interface Message {
  id: string
  context_type: 'group' | 'activity'
  context_id: string
  sender_id: string
  body: string
  created_at: string
}

// Admin stats
export interface OrganizationStats {
  id: string
  name: string
  owner_name: string
  owner_email: string | null
  owner_phone: string
  member_count: number
  group_count: number
  activity_count: number
  message_count: number
  created_at: string
  last_activity_at: string | null
}
