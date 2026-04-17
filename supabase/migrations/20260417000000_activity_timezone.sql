-- Store the creator's IANA timezone on activities so reminders fire at the correct local time
alter table whozin_activity add column if not exists timezone text;
