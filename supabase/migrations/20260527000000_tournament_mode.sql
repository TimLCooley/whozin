-- Tournament Mode (Pro feature)
-- Layered on top of an activity. Two formats for v1:
--   * round_robin — auto-generates N*(N-1)/2 matches via the circle method
--   * assigned — host manually pairs players one match at a time
-- W/L only, no scoring or brackets. Either player can record their own result.

alter table whozin_activity
  add column if not exists tournament_mode boolean not null default false,
  add column if not exists tournament_format text
    check (tournament_format is null or tournament_format in ('assigned', 'round_robin')),
  add column if not exists tournament_started_at timestamptz;

create table if not exists whozin_match (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references whozin_activity(id) on delete cascade,
  round_number int not null default 1,
  player_a_id uuid not null references whozin_users(id) on delete cascade,
  player_b_id uuid not null references whozin_users(id) on delete cascade,
  winner_id uuid references whozin_users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'forfeit')),
  recorded_by uuid references whozin_users(id) on delete set null,
  recorded_at timestamptz,
  created_at timestamptz not null default now()
);

-- All reads/writes go through API routes using the service-role key (which
-- bypasses RLS). Enabling RLS without policies blocks direct anon-key access
-- from the browser, matching the convention used by every other table.
alter table whozin_match enable row level security;

create index if not exists whozin_match_activity_idx on whozin_match(activity_id);
create index if not exists whozin_match_player_a_idx on whozin_match(activity_id, player_a_id);
create index if not exists whozin_match_player_b_idx on whozin_match(activity_id, player_b_id);

-- Sanity guards: a match must be between two distinct players, and the winner
-- (when set) must be one of those two.
alter table whozin_match
  add constraint whozin_match_distinct_players_chk check (player_a_id <> player_b_id);

alter table whozin_match
  add constraint whozin_match_winner_is_player_chk
    check (winner_id is null or winner_id = player_a_id or winner_id = player_b_id);
