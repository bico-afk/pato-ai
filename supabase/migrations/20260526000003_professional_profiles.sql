-- TABELA: professional_profiles
create table if not exists professional_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references users(id) on delete cascade,
  headline text,
  skills text[],
  service_radius_km integer default 50,
  location_text text,
  location_city text,
  location_state text,
  location_country text default 'BR',
  location_google_place_id text,
  location_point geography(Point, 4326),
  avg_rating numeric(3,2) default 0,
  total_reviews integer default 0,
  total_jobs_completed integer default 0,
  trust_score numeric(5,2) default 0,
  is_available boolean default true,
  portfolio_urls text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_professional_location on professional_profiles using gist(location_point);
create index if not exists idx_professional_skills on professional_profiles using gin(skills);

-- RLS
alter table professional_profiles enable row level security;

create policy "professional_profiles_read" on professional_profiles
  for select using (true);

create policy "professional_profiles_write" on professional_profiles
  for all using (auth.uid() = (select auth_id from users where id = user_id));
