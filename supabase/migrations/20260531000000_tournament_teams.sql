-- Fixed-partner doubles teams, stored explicitly so the host can edit them
-- on the Teams tab (rearrange, reroll, skill-match).
--
-- Shape: an array of two-player pairs, e.g.
--   [["uuid-a","uuid-b"], ["uuid-c","uuid-d"]]
-- Order is the display order. Null for non-doubles or before teams form.
-- When teams change, the round-robin matches are regenerated from them.

alter table whozin_activity
  add column if not exists tournament_teams jsonb;
