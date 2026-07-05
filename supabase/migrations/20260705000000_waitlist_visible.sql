-- Wait List visibility
-- When a host enables the wait list, they can also control whether members can
-- see it — how many people are waiting and their own position. On by default;
-- the host can turn it off so only they see the wait list.

alter table whozin_activity
  add column if not exists waitlist_visible boolean not null default true;
