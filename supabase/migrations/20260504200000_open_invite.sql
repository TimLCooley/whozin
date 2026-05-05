-- Open Invite: when enabled, anyone confirmed (status = 'confirmed') in the
-- activity can add new members the same way the host can. Off by default.

alter table whozin_activity
  add column if not exists open_invite boolean not null default false;
