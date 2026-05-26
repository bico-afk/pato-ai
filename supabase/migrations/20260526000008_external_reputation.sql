-- TABELA: external_reputation
create table if not exists external_reputation (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'google', 'facebook')),
  platform_id text,
  followers_count integer,
  avg_rating numeric(3,2),
  review_count integer,
  profile_url text,
  verified_at timestamptz,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform)
);
