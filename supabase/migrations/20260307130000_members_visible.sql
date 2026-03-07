-- Add members_visible option to groups (host controls if non-hosts can see member list)
alter table whozin_groups add column members_visible boolean not null default true;
