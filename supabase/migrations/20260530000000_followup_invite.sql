-- Follow-up invites: a "last call" nudge 24h before the event.
--
-- When enabled, the process-reminders cron checks ~24h out. If the activity
-- still has open spots (not full), it sends a follow-up message to everyone
-- who hasn't decided yet (member status not in confirmed/out) and creates a
-- fresh pending invite for each so they can reply IN by SMS or in-app.

alter table whozin_activity
  add column if not exists followup_invite_enabled boolean not null default false;
