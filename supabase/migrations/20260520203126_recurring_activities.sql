-- Recurring activities
-- Host can set an activity to repeat. When the activity moves to past, the
-- system auto-spawns the next occurrence as a 'draft' (host must approve to
-- send invites). One draft at a time per chain; stale drafts auto-deleted.

alter table whozin_activity
  add column if not exists repeat_interval text not null default 'none'
    check (repeat_interval in ('none', 'weekly', 'biweekly', 'monthly'));

alter table whozin_activity
  add column if not exists parent_activity_id uuid
    references whozin_activity(id) on delete set null;

-- Extend activity status check to allow 'draft'
alter table whozin_activity
  drop constraint if exists whozin_activity_status_check;

alter table whozin_activity
  add constraint whozin_activity_status_check
  check (status in ('draft', 'open', 'full', 'past', 'cancelled'));

create index if not exists whozin_activity_parent_idx
  on whozin_activity(parent_activity_id);
