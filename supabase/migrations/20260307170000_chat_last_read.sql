-- Track when users last read chat messages (for "catch up" feature)
create table if not exists whozin_chat_read (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references whozin_users(id) on delete cascade,
  context_type text not null check (context_type in ('group', 'activity')),
  context_id uuid not null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, context_type, context_id)
);

create index idx_whozin_chat_read_lookup on whozin_chat_read(user_id, context_type, context_id);

alter table whozin_chat_read enable row level security;

create policy "Users can manage own read status"
  on whozin_chat_read for all
  using (user_id in (select id from whozin_users where auth_user_id = auth.uid()));
