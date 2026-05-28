-- Round-by-round progression for tournament mode.
-- The schedule is still fully generated up front (so we know how many matches
-- in total), but only matches with round_number <= tournament_current_round
-- are revealed to players. The host taps "Start Round N+1" to bump this.
--
-- 0 means started but no rounds revealed yet (transient state); 1+ means
-- that round is the latest active.

alter table whozin_activity
  add column if not exists tournament_current_round int not null default 0;
