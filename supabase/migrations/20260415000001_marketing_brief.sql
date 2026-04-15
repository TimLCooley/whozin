-- Marketing brief: single-row product context the CMO agent uses for every suggestion.
-- Also marketing_ideas: AI-proposed content ideas that haven't become content items yet.
-- Super admin only. Locked down via RLS (no authenticated policies).

create table if not exists whozin_marketing_brief (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  product_one_liner text,
  ideal_customer text,
  customer_pain text,
  why_we_win text,
  what_worked text,
  what_flopped text,
  forbidden_tactics text,
  voice_rules text,
  intake_conversation jsonb not null default '[]'::jsonb,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint whozin_marketing_brief_singleton unique (singleton)
);

drop trigger if exists trg_marketing_brief_updated on whozin_marketing_brief;
create trigger trg_marketing_brief_updated
  before update on whozin_marketing_brief
  for each row execute function whozin_marketing_set_updated_at();

alter table whozin_marketing_brief enable row level security;

create table if not exists whozin_marketing_ideas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references whozin_marketing_campaigns(id) on delete set null,
  title text not null,
  hook text,
  hook_type text,
  framework text,
  channel text not null,
  why_it_might_work text,
  draft_body text,
  status text not null default 'proposed'
    check (status in ('proposed', 'drafting', 'drafted', 'rejected', 'archived')),
  content_item_id uuid references whozin_marketing_content_items(id) on delete set null,
  source_prompt text,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_ideas_status on whozin_marketing_ideas(status);
create index if not exists idx_marketing_ideas_created on whozin_marketing_ideas(created_at desc);
create index if not exists idx_marketing_ideas_campaign on whozin_marketing_ideas(campaign_id);

alter table whozin_marketing_ideas enable row level security;
