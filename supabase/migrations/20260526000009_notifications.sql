-- TABELA: notifications
create table if not exists notifications (
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

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id) where is_read = false;

-- RLS
alter table notifications enable row level security;

create policy "notifications_own" on notifications
  for all using (auth.uid() = (select auth_id from users where id = user_id));
