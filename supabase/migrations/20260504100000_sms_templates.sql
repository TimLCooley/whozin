-- SMS template overrides. Defaults live in code (src/lib/sms-templates.ts);
-- this row stores admin overrides keyed by template id. An unset id falls back
-- to the default.

insert into whozin_settings (key, value)
values ('sms_templates', '{}'::jsonb)
on conflict (key) do nothing;
