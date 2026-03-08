-- Change response_timer_minutes from integer to numeric to support sub-minute values (e.g. 0.083 = 5 seconds)
alter table whozin_activity alter column response_timer_minutes type numeric using response_timer_minutes::numeric;
