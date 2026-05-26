-- TABELA: admin_logs
create table if not exists admin_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
