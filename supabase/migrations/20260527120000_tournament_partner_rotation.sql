-- Rotating-partner doubles mode.
--
-- When tournament_partner_rotation is true (only valid alongside
-- tournament_doubles = true), every round shuffles the partners and
-- opponents anew. The full schedule is generated round-by-round on the
-- server: Start emits round 1; each Advance emits a fresh round with
-- random partner+opponent picks. Standings are per-individual (already
-- the case in computeStandings), so the leaderboard works without changes.

alter table whozin_activity
  add column if not exists tournament_partner_rotation boolean not null default false;
