-- Chat access flag for activity members.
-- Normally chat is for confirmed members + the host (creator). When a host hands
-- off hosting and leaves, we still want them in the chat to help coordinate, so
-- we set chat_access = true on their member row. The messages API grants access
-- to: confirmed OR chat_access OR the current creator.

alter table whozin_activity_member
  add column if not exists chat_access boolean not null default false;
