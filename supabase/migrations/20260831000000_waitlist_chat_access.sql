-- Host toggle: let people on the wait list read + send in the activity chat.
-- Off by default — chat stays confirmed-members-only unless the host opts in.
-- Enforced in the messages API: waitlist members get access only while this
-- flag is on (alongside the existing confirmed / chat_access / creator rules).

alter table whozin_activity
  add column if not exists waitlist_chat_access boolean not null default false;
