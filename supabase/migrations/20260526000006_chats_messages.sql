-- TABELA: chats
create table if not exists chats (
  id uuid primary key default uuid_generate_v4(),
  demand_id uuid references demands(id) on delete cascade,
  application_id uuid unique references applications(id) on delete cascade,
  client_id uuid references users(id) on delete set null,
  professional_id uuid references users(id) on delete set null,
  status text default 'active' check (status in ('active', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_chats_client on chats(client_id);
create index if not exists idx_chats_professional on chats(professional_id);

-- TABELA: messages
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  content text,
  media_urls text[],
  message_type text default 'text' check (message_type in ('text', 'image', 'video', 'system')),
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_messages_chat on messages(chat_id);
create index if not exists idx_messages_created on messages(created_at asc);

-- RLS: chats
alter table chats enable row level security;

create policy "chats_participants" on chats
  for all using (
    auth.uid() = (select auth_id from users where id = client_id)
    or
    auth.uid() = (select auth_id from users where id = professional_id)
  );

-- RLS: messages
alter table messages enable row level security;

create policy "messages_participants" on messages
  for all using (
    auth.uid() in (
      select u.auth_id from users u
      join chats c on c.client_id = u.id or c.professional_id = u.id
      where c.id = chat_id
    )
  );
