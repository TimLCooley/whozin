-- Add a separate physical address to activities so non-Places locations
-- (e.g. "Tim's House") can still be used in calendar invites and map links.
alter table whozin_activity
  add column if not exists address text;
