-- Whozin Initial Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh/sql

-- =============================================================================
-- USERS
-- =============================================================================

create table whozin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  phone text not null unique,
  country_code text not null default '1',
  first_name text not null,
  last_name text not null,
  email text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'invited')),
  membership_tier text not null default 'free' check (membership_tier in ('free', 'pro')),
  push_notifications_enabled boolean not null default true,
  text_notifications_enabled boolean not null default true,
  hide_from_invites boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whozin_users_auth_user_id on whozin_users(auth_user_id);
create index idx_whozin_users_phone on whozin_users(phone);
create index idx_whozin_users_email on whozin_users(email);

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

create table whozin_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references whozin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whozin_organizations_owner_id on whozin_organizations(owner_id);

create table whozin_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references whozin_organizations(id) on delete cascade,
  user_id uuid not null references whozin_users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create index idx_whozin_org_members_org_id on whozin_organization_members(organization_id);
create index idx_whozin_org_members_user_id on whozin_organization_members(user_id);

-- =============================================================================
-- GROUPS (belong to an organization)
-- =============================================================================

create table whozin_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references whozin_organizations(id) on delete cascade,
  creator_id uuid not null references whozin_users(id) on delete cascade,
  name text not null,
  chat_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whozin_groups_org_id on whozin_groups(organization_id);
create index idx_whozin_groups_creator_id on whozin_groups(creator_id);

create table whozin_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references whozin_groups(id) on delete cascade,
  user_id uuid not null references whozin_users(id) on delete cascade,
  priority_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create index idx_whozin_group_members_group_id on whozin_group_members(group_id);
create index idx_whozin_group_members_user_id on whozin_group_members(user_id);

-- =============================================================================
-- ACTIVITIES (belong to a group)
-- =============================================================================

create table whozin_activity (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references whozin_users(id) on delete cascade,
  group_id uuid not null references whozin_groups(id) on delete cascade,
  activity_type text not null default 'general',
  activity_name text not null,
  activity_date date,
  activity_time time,
  location text,
  cost numeric(10,2),
  max_capacity integer,
  capacity_current integer not null default 0,
  response_timer_minutes integer,
  status text not null default 'open' check (status in ('open', 'full', 'past', 'cancelled')),
  chat_enabled boolean not null default true,
  invite_processing boolean not null default false,
  current_invite_batch integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whozin_activity_group_id on whozin_activity(group_id);
create index idx_whozin_activity_creator_id on whozin_activity(creator_id);
create index idx_whozin_activity_status on whozin_activity(status);

create table whozin_activity_member (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references whozin_activity(id) on delete cascade,
  user_id uuid not null references whozin_users(id) on delete cascade,
  status text not null default 'tbd' check (status in ('confirmed', 'tbd', 'waiting', 'out', 'missed')),
  priority_order integer not null default 0,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(activity_id, user_id)
);

create index idx_whozin_activity_member_activity_id on whozin_activity_member(activity_id);
create index idx_whozin_activity_member_user_id on whozin_activity_member(user_id);

-- =============================================================================
-- INVITATIONS (SMS/email invites for activities)
-- =============================================================================

create table whozin_invite (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references whozin_activity(id) on delete cascade,
  user_id uuid not null references whozin_users(id) on delete cascade,
  batch_number integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'responded', 'expired')),
  sms_sid text,
  sent_at timestamptz,
  expires_at timestamptz,
  response text,
  created_at timestamptz not null default now()
);

create index idx_whozin_invite_activity_id on whozin_invite(activity_id);
create index idx_whozin_invite_user_id on whozin_invite(user_id);

-- =============================================================================
-- MESSAGES (group or activity chat)
-- =============================================================================

create table whozin_message (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('group', 'activity')),
  context_id uuid not null,
  sender_id uuid not null references whozin_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_whozin_message_context on whozin_message(context_type, context_id);
create index idx_whozin_message_sender_id on whozin_message(sender_id);

-- =============================================================================
-- BLOCKED USERS
-- =============================================================================

create table whozin_blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references whozin_users(id) on delete cascade,
  blocked_id uuid not null references whozin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

-- =============================================================================
-- PASSWORD RESET (phone-based)
-- =============================================================================

create table whozin_password_reset_code (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_whozin_password_reset_phone on whozin_password_reset_code(phone);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_whozin_users_updated_at
  before update on whozin_users
  for each row execute function update_updated_at();

create trigger trg_whozin_organizations_updated_at
  before update on whozin_organizations
  for each row execute function update_updated_at();

create trigger trg_whozin_groups_updated_at
  before update on whozin_groups
  for each row execute function update_updated_at();

create trigger trg_whozin_activity_updated_at
  before update on whozin_activity
  for each row execute function update_updated_at();

-- =============================================================================
-- AUTO-CREATE WHOZIN USER ON SIGN-UP
-- =============================================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  v_phone text;
  v_first_name text;
  v_last_name text;
  v_email text;
begin
  -- Extract phone from synthetic email (e.g., +16193019180@whozin.app)
  if new.email like '%@whozin.app' then
    v_phone := replace(new.email, '@whozin.app', '');
    v_email := null;
  else
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_email := new.email;
  end if;

  v_first_name := coalesce(new.raw_user_meta_data->>'first_name', '');
  v_last_name := coalesce(new.raw_user_meta_data->>'last_name', '');

  insert into public.whozin_users (
    auth_user_id,
    phone,
    country_code,
    first_name,
    last_name,
    email
  ) values (
    new.id,
    v_phone,
    coalesce(new.raw_user_meta_data->>'country_code', '1'),
    v_first_name,
    v_last_name,
    v_email
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table whozin_users enable row level security;
alter table whozin_organizations enable row level security;
alter table whozin_organization_members enable row level security;
alter table whozin_groups enable row level security;
alter table whozin_group_members enable row level security;
alter table whozin_activity enable row level security;
alter table whozin_activity_member enable row level security;
alter table whozin_invite enable row level security;
alter table whozin_message enable row level security;
alter table whozin_blocked_users enable row level security;
alter table whozin_password_reset_code enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on whozin_users for select
  using (auth.uid() = auth_user_id);

-- Users can update their own profile
create policy "Users can update own profile"
  on whozin_users for update
  using (auth.uid() = auth_user_id);

-- Service role can do everything (for admin pages via API routes)
-- Note: service_role bypasses RLS by default, so no explicit policy needed

-- Org members can read their org
create policy "Org members can read org"
  on whozin_organizations for select
  using (
    id in (
      select organization_id from whozin_organization_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    )
  );

-- Org owners can update their org
create policy "Org owners can update org"
  on whozin_organizations for update
  using (
    owner_id in (select id from whozin_users where auth_user_id = auth.uid())
  );

-- Users can create orgs
create policy "Users can create orgs"
  on whozin_organizations for insert
  with check (
    owner_id in (select id from whozin_users where auth_user_id = auth.uid())
  );

-- Org members can read membership list
create policy "Org members can read members"
  on whozin_organization_members for select
  using (
    organization_id in (
      select organization_id from whozin_organization_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    )
  );

-- Org admins/owners can manage members
create policy "Org admins can insert members"
  on whozin_organization_members for insert
  with check (
    organization_id in (
      select organization_id from whozin_organization_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- Group members can read their groups
create policy "Group members can read groups"
  on whozin_groups for select
  using (
    id in (
      select group_id from whozin_group_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    )
  );

-- Group members can read group membership
create policy "Group members can read group members"
  on whozin_group_members for select
  using (
    group_id in (
      select group_id from whozin_group_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    )
  );

-- Activity participants can read activities
create policy "Activity participants can read activities"
  on whozin_activity for select
  using (
    group_id in (
      select group_id from whozin_group_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    )
  );

-- Activity members can read their membership
create policy "Activity members can read activity members"
  on whozin_activity_member for select
  using (
    activity_id in (
      select id from whozin_activity where group_id in (
        select group_id from whozin_group_members
        where user_id in (select id from whozin_users where auth_user_id = auth.uid())
      )
    )
  );

-- Message readers must be in the context (group or activity)
create policy "Context members can read messages"
  on whozin_message for select
  using (
    (context_type = 'group' and context_id in (
      select group_id from whozin_group_members
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    ))
    or
    (context_type = 'activity' and context_id in (
      select activity_id from whozin_activity_member
      where user_id in (select id from whozin_users where auth_user_id = auth.uid())
    ))
  );

-- Context members can send messages
create policy "Context members can send messages"
  on whozin_message for insert
  with check (
    sender_id in (select id from whozin_users where auth_user_id = auth.uid())
  );

-- Users can manage their own blocks
create policy "Users can read own blocks"
  on whozin_blocked_users for select
  using (blocker_id in (select id from whozin_users where auth_user_id = auth.uid()));

create policy "Users can insert blocks"
  on whozin_blocked_users for insert
  with check (blocker_id in (select id from whozin_users where auth_user_id = auth.uid()));

create policy "Users can delete own blocks"
  on whozin_blocked_users for delete
  using (blocker_id in (select id from whozin_users where auth_user_id = auth.uid()));
