-- TABELA: users
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  phone text,
  phone_country_code text default '+55',
  whatsapp_id text unique,
  email text unique,
  preferred_language text default 'pt',
  is_anonymous boolean default false,
  is_active boolean default true,
  is_suspended boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table users enable row level security;

create policy "users_own" on users
  for all using (auth.uid() = auth_id);
