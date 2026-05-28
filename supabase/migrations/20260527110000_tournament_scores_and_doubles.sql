-- Tournament Pass 2: scores + doubles.
--
-- tournament_track_scores: when true, players enter score_a / score_b on each
-- match and the winner is derived (higher score). When false, it's pure W/L
-- like today.
--
-- tournament_doubles: pickleball-only doubles mode. Adds player_c_id and
-- player_d_id to a match so each side has two players. Team A = (player_a,
-- player_c); Team B = (player_b, player_d). Singles matches leave player_c
-- and player_d null. Partners are assigned by a Shuffle action at tournament
-- start; v1 has no manual edit.
--
-- Scores: a single integer per side per match. No sets, no best-of for v1.

alter table whozin_activity
  add column if not exists tournament_track_scores boolean not null default false,
  add column if not exists tournament_doubles boolean not null default false;

alter table whozin_match
  add column if not exists score_a int,
  add column if not exists score_b int,
  add column if not exists player_c_id uuid references whozin_users(id) on delete cascade,
  add column if not exists player_d_id uuid references whozin_users(id) on delete cascade;

-- Both sides of a doubles match need their second player or neither does.
alter table whozin_match
  add constraint whozin_match_doubles_chk
    check ((player_c_id is null and player_d_id is null) or
           (player_c_id is not null and player_d_id is not null));
