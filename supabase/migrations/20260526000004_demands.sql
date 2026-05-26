-- TABELA: demands
create table if not exists demands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  anonymous_token text unique,
  title text not null,
  description text not null,
  category text,
  status text default 'open' check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  location_text text,
  location_city text,
  location_state text,
  location_country text default 'BR',
  location_google_place_id text,
  location_point geography(Point, 4326),
  media_urls text[],
  candidate_count integer default 0,
  language text default 'pt',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  closed_at timestamptz
);

create index if not exists idx_demands_location on demands using gist(location_point);
create index if not exists idx_demands_status on demands(status);
create index if not exists idx_demands_created on demands(created_at desc);
create index if not exists idx_demands_search on demands
  using gin(to_tsvector('portuguese', title || ' ' || description));

-- RLS
alter table demands enable row level security;

create policy "demands_read" on demands
  for select using (true);

create policy "demands_write" on demands
  for all using (auth.uid() = (select auth_id from users where id = user_id));
