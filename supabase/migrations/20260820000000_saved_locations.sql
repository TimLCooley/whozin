-- Host-saved locations: a per-user list of reusable {name, address} places so
-- hosts don't re-type their regular venues on every activity.

create table if not exists whozin_saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references whozin_users(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create index if not exists whozin_saved_locations_user_idx
  on whozin_saved_locations(user_id);

-- One saved entry per name per host (case-insensitive), so re-saving updates
-- rather than duplicating.
create unique index if not exists whozin_saved_locations_user_name_idx
  on whozin_saved_locations(user_id, lower(name));
