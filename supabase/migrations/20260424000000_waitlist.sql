-- Wait List feature
-- Hosts (Pro) can enable a wait list on activities. When the activity is full,
-- members who would normally be denied (status: missed/out replying "in") get
-- placed on the wait list. When a confirmed member drops, the earliest wait
-- list member is auto-promoted to confirmed.

alter table whozin_activity
  add column if not exists waitlist_enabled boolean not null default false;

-- Extend the member status check constraint to allow 'waitlist'
alter table whozin_activity_member
  drop constraint if exists whozin_activity_member_status_check;

alter table whozin_activity_member
  add constraint whozin_activity_member_status_check
  check (status in ('confirmed', 'tbd', 'waiting', 'out', 'missed', 'waitlist'));
