-- TABELA: reviews
create table if not exists reviews (
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

create index if not exists idx_reviews_reviewed on reviews(reviewed_id);

-- RLS (reviews são públicos para leitura)
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
