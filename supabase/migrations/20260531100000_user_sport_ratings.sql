-- Self-reported sport ratings on the user profile.
--   pickleball_rating: DUPR-style 2.0–8.0 scale (we don't hard-enforce the
--                      range; players type what they have).
--   golf_handicap:     standard handicap index, can be negative for plus
--                      handicaps, up to ~54.
-- Both nullable — players fill in only what applies to them. Used by the
-- tournament Teams skill-match.

alter table whozin_users
  add column if not exists pickleball_rating numeric(4,2),
  add column if not exists golf_handicap numeric(4,1);
