-- Alerts / notification history
create table whozin_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references whozin_users(id) on delete cascade,
  type text not null check (type in ('group_invite', 'member_joined', 'chat_message', 'activity_invite', 'system')),
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  meta jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_whozin_alerts_user_id on whozin_alerts(user_id);
create index idx_whozin_alerts_user_read on whozin_alerts(user_id, read);

alter table whozin_alerts enable row level security;

create policy "Users can read own alerts"
  on whozin_alerts for select
  using (user_id in (select id from whozin_users where auth_user_id = auth.uid()));

create policy "Users can update own alerts"
  on whozin_alerts for update
  using (user_id in (select id from whozin_users where auth_user_id = auth.uid()));
