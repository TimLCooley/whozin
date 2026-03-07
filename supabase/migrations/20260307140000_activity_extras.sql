-- Add new columns to whozin_activity for the full creation flow
alter table whozin_activity add column if not exists note text;
alter table whozin_activity add column if not exists cost_type text not null default 'free' check (cost_type in ('free', 'pay_me', 'pay_at_location'));
alter table whozin_activity add column if not exists reminder_enabled boolean not null default false;
alter table whozin_activity add column if not exists priority_invite boolean not null default true;
alter table whozin_activity add column if not exists image_url text;
