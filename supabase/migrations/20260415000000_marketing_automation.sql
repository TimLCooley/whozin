-- Marketing automation: campaigns, content items, metrics.
-- Phase 1 of admin/marketing tool. Super admin only.
-- RLS: whozin_marketing_* tables are locked down (no authenticated policies).
-- Server access via getAdminClient() with service role.

create table if not exists whozin_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  topic text,
  angle text,
  goal_type text not null default 'app_downloads'
    check (goal_type in ('app_downloads', 'custom')),
  goal_target integer,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_marketing_campaigns_status on whozin_marketing_campaigns(status);

create table if not exists whozin_marketing_content_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references whozin_marketing_campaigns(id) on delete cascade,
  parent_id uuid references whozin_marketing_content_items(id) on delete set null,
  channel text not null
    check (channel in ('tiktok','linkedin','reddit','facebook','instagram','newsletter','other')),
  content_type text not null default 'text'
    check (content_type in ('text','carousel','image','video','link')),
  title text,
  body_text text,
  image_urls text[] not null default '{}',
  short_code text unique,
  destination_url text,
  status text not null default 'draft'
    check (status in ('draft','review','approved','scheduled','posted','archived')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  post_url text,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_marketing_content_campaign on whozin_marketing_content_items(campaign_id);
create index if not exists idx_marketing_content_parent on whozin_marketing_content_items(parent_id);
create index if not exists idx_marketing_content_status on whozin_marketing_content_items(status);
create index if not exists idx_marketing_content_short_code
  on whozin_marketing_content_items(short_code) where short_code is not null;

create table if not exists whozin_marketing_content_metrics (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references whozin_marketing_content_items(id) on delete cascade,
  metric_type text not null
    check (metric_type in ('click','impression','view','like','share','comment','conversion')),
  value integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_marketing_metrics_content
  on whozin_marketing_content_metrics(content_item_id, recorded_at desc);

create or replace function whozin_marketing_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_marketing_campaigns_updated on whozin_marketing_campaigns;
create trigger trg_marketing_campaigns_updated
  before update on whozin_marketing_campaigns
  for each row execute function whozin_marketing_set_updated_at();

drop trigger if exists trg_marketing_content_updated on whozin_marketing_content_items;
create trigger trg_marketing_content_updated
  before update on whozin_marketing_content_items
  for each row execute function whozin_marketing_set_updated_at();

alter table whozin_marketing_campaigns enable row level security;
alter table whozin_marketing_content_items enable row level security;
alter table whozin_marketing_content_metrics enable row level security;
