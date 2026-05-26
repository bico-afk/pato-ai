-- ── DROP (ordem inversa de dependência) ────────────────────────
drop table if exists admin_logs cascade;
drop table if exists notifications cascade;
drop table if exists external_reputation cascade;
drop table if exists reviews cascade;
drop table if exists messages cascade;
drop table if exists chats cascade;
drop table if exists applications cascade;
drop table if exists demands cascade;
drop table if exists professional_profiles cascade;
drop table if exists users cascade;
drop function if exists search_professionals cascade;
drop function if exists update_professional_rating cascade;

-- ── Extensions ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ── TABELA: users ───────────────────────────────────────────────
create table users (
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

alter table users enable row level security;
create policy "users_own" on users
  for all using (auth.uid() = auth_id);

-- ── TABELA: professional_profiles ──────────────────────────────
create table professional_profiles (
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

create index idx_professional_location on professional_profiles using gist(location_point);
create index idx_professional_skills on professional_profiles using gin(skills);

alter table professional_profiles enable row level security;
create policy "professional_profiles_read" on professional_profiles
  for select using (true);
create policy "professional_profiles_write" on professional_profiles
  for all using (auth.uid() = (select auth_id from users where id = user_id));

-- ── TABELA: demands ─────────────────────────────────────────────
create table demands (
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

create index idx_demands_location on demands using gist(location_point);
create index idx_demands_status on demands(status);
create index idx_demands_created on demands(created_at desc);
create index idx_demands_search on demands
  using gin(to_tsvector('portuguese', title || ' ' || description));

alter table demands enable row level security;
create policy "demands_read" on demands
  for select using (true);
create policy "demands_write" on demands
  for all using (auth.uid() = (select auth_id from users where id = user_id));

-- ── TABELA: applications ────────────────────────────────────────
create table applications (
  id uuid primary key default uuid_generate_v4(),
  demand_id uuid references demands(id) on delete cascade,
  professional_id uuid references users(id) on delete cascade,
  message text not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(demand_id, professional_id)
);

create index idx_applications_demand on applications(demand_id);
create index idx_applications_professional on applications(professional_id);

-- ── TABELA: chats ───────────────────────────────────────────────
create table chats (
  id uuid primary key default uuid_generate_v4(),
  demand_id uuid references demands(id) on delete cascade,
  application_id uuid unique references applications(id) on delete cascade,
  client_id uuid references users(id) on delete set null,
  professional_id uuid references users(id) on delete set null,
  status text default 'active' check (status in ('active', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_chats_client on chats(client_id);
create index idx_chats_professional on chats(professional_id);

alter table chats enable row level security;
create policy "chats_participants" on chats
  for all using (
    auth.uid() = (select auth_id from users where id = client_id)
    or
    auth.uid() = (select auth_id from users where id = professional_id)
  );

-- ── TABELA: messages ────────────────────────────────────────────
create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  content text,
  media_urls text[],
  message_type text default 'text' check (message_type in ('text', 'image', 'video', 'system')),
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_messages_chat on messages(chat_id);
create index idx_messages_created on messages(created_at asc);

alter table messages enable row level security;
create policy "messages_participants" on messages
  for all using (
    auth.uid() in (
      select u.auth_id from users u
      join chats c on c.client_id = u.id or c.professional_id = u.id
      where c.id = chat_id
    )
  );

-- ── TABELA: reviews ─────────────────────────────────────────────
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  demand_id uuid references demands(id) on delete cascade,
  chat_id uuid references chats(id) on delete cascade,
  reviewer_id uuid references users(id) on delete set null,
  reviewed_id uuid references users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(chat_id, reviewer_id)
);

create index idx_reviews_reviewed on reviews(reviewed_id);

alter table reviews enable row level security;
create policy "reviews_read" on reviews
  for select using (true);
create policy "reviews_write" on reviews
  for insert using (auth.uid() = (select auth_id from users where id = reviewer_id));

-- FUNÇÃO: atualizar avg_rating automaticamente
create or replace function update_professional_rating()
returns trigger as $$
begin
  update professional_profiles
  set
    avg_rating = (
      select round(avg(rating)::numeric, 2)
      from reviews
      where reviewed_id = new.reviewed_id
    ),
    total_reviews = (
      select count(*) from reviews
      where reviewed_id = new.reviewed_id
    )
  where user_id = new.reviewed_id;
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_rating
  after insert on reviews
  for each row execute function update_professional_rating();

-- ── TABELA: external_reputation ─────────────────────────────────
create table external_reputation (
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

-- ── TABELA: notifications ───────────────────────────────────────
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  channel text[] default array['whatsapp', 'email'],
  is_read boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id) where is_read = false;

alter table notifications enable row level security;
create policy "notifications_own" on notifications
  for all using (auth.uid() = (select auth_id from users where id = user_id));

-- ── TABELA: admin_logs ──────────────────────────────────────────
create table admin_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ── FUNÇÃO: busca por raio com expansão automática ──────────────
create or replace function search_professionals(
  search_query text,
  lat float,
  lng float,
  radius_km float default 50,
  max_radius_km float default 500
)
returns table (
  user_id uuid,
  username text,
  headline text,
  avg_rating numeric,
  total_jobs_completed integer,
  distance_km float,
  location_city text
) as $$
declare
  current_radius float := radius_km;
  result_count integer := 0;
begin
  loop
    return query
      select
        u.id,
        u.username,
        pp.headline,
        pp.avg_rating,
        pp.total_jobs_completed,
        round((st_distance(
          pp.location_point,
          st_makepoint(lng, lat)::geography
        ) / 1000)::numeric, 1)::float,
        pp.location_city
      from professional_profiles pp
      join users u on u.id = pp.user_id
      where
        pp.is_available = true
        and u.is_active = true
        and u.is_suspended = false
        and st_dwithin(
          pp.location_point,
          st_makepoint(lng, lat)::geography,
          current_radius * 1000
        )
        and (
          search_query = ''
          or pp.skills && array[search_query]
          or pp.headline ilike '%' || search_query || '%'
          or to_tsvector('portuguese', coalesce(pp.headline, '')) @@ plainto_tsquery('portuguese', search_query)
        )
      order by
        pp.avg_rating desc,
        st_distance(pp.location_point, st_makepoint(lng, lat)::geography) asc;

    get diagnostics result_count = row_count;
    exit when result_count > 0 or current_radius >= max_radius_km;
    current_radius := least(current_radius * 2, max_radius_km);
  end loop;
end;
$$ language plpgsql;
