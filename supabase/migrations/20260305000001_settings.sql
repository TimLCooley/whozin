-- Whozin Settings & Branding
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh/sql

-- =============================================================================
-- APP SETTINGS (key-value store for all config)
-- =============================================================================

create table whozin_settings (
  key text primary key,
  value jsonb not null default '""'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed default settings
insert into whozin_settings (key, value) values
  -- General
  ('app_name', '"Whozin"'),
  ('app_tagline', '"Who''s In?"'),
  ('app_description', '"The smarter way to organize group activities."'),

  -- Contact
  ('support_email', '""'),
  ('return_email', '""'),
  ('reply_to_email', '""'),
  ('from_name', '"Whozin"'),
  ('physical_address', '""'),
  ('phone_number', '""'),

  -- Branding / Logos (will store storage URLs)
  ('logo_full', '""'),
  ('logo_icon', '""'),
  ('logo_dark', '""'),
  ('logo_favicon', '""'),
  ('brand_color_primary', '"#6366f1"'),
  ('brand_color_secondary', '"#818cf8"'),

  -- Legal (rich text / markdown content)
  ('terms_of_service', '""'),
  ('privacy_policy', '""'),
  ('acceptable_use_policy', '""'),
  ('cookie_policy', '""'),

  -- Social
  ('social_twitter', '""'),
  ('social_instagram', '""'),
  ('social_facebook', '""'),
  ('social_linkedin', '""'),
  ('social_tiktok', '""'),

  -- App Store
  ('app_store_url', '""'),
  ('play_store_url', '""')
on conflict (key) do nothing;

-- Auto-update timestamp
create trigger trg_whozin_settings_updated_at
  before update on whozin_settings
  for each row execute function update_updated_at();

-- RLS: read-only for authenticated users, write via service role
alter table whozin_settings enable row level security;

create policy "Anyone can read settings"
  on whozin_settings for select
  using (true);

-- =============================================================================
-- STORAGE BUCKET for branding assets
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Allow public read access to branding bucket
create policy "Public read branding"
  on storage.objects for select
  using (bucket_id = 'branding');

-- Allow service role (admin) to upload/delete
-- Note: service_role bypasses RLS, so no explicit insert/delete policy needed
