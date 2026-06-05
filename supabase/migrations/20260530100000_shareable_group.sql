-- Shared groups.
--
-- When shareable is true, members of the group (not just the owner) can:
--   • host activities targeting this group, as if it were their own
--   • copy the group into their own group list (an independent fork)
--
-- Off by default — groups stay private to their owner unless explicitly shared.

alter table whozin_groups
  add column if not exists shareable boolean not null default false;
