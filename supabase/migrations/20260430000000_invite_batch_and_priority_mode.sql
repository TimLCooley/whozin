-- Pro feature: configurable invite cascade
--   invite_batch_size: how many invites go out per cycle (null = match remaining spots)
--   invite_priority_mode: order in which 'tbd' members are picked for the next batch

alter table whozin_activity
  add column if not exists invite_batch_size integer;

alter table whozin_activity
  add column if not exists invite_priority_mode text not null default 'top_down';

alter table whozin_activity
  drop constraint if exists whozin_activity_invite_priority_mode_check;

alter table whozin_activity
  add constraint whozin_activity_invite_priority_mode_check
  check (invite_priority_mode in ('top_down', 'random'));
