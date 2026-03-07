-- Friends pool: persistent contacts that survive group removal
create table whozin_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references whozin_users(id) on delete cascade,
  friend_id uuid not null references whozin_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

create index idx_whozin_friends_user_id on whozin_friends(user_id);
create index idx_whozin_friends_friend_id on whozin_friends(friend_id);

alter table whozin_friends enable row level security;

create policy "Users can read own friends"
  on whozin_friends for select
  using (user_id in (select id from whozin_users where auth_user_id = auth.uid()));

create policy "Users can insert own friends"
  on whozin_friends for insert
  with check (user_id in (select id from whozin_users where auth_user_id = auth.uid()));

create policy "Users can delete own friends"
  on whozin_friends for delete
  using (user_id in (select id from whozin_users where auth_user_id = auth.uid()));

-- Backfill: add all existing group members as friends
insert into whozin_friends (user_id, friend_id)
select distinct gm1.user_id, gm2.user_id
from whozin_group_members gm1
join whozin_group_members gm2 on gm1.group_id = gm2.group_id
where gm1.user_id != gm2.user_id
on conflict do nothing;
