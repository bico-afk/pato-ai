-- TABELA: applications
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  demand_id uuid references demands(id) on delete cascade,
  professional_id uuid references users(id) on delete cascade,
  message text not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(demand_id, professional_id)
);

create index if not exists idx_applications_demand on applications(demand_id);
create index if not exists idx_applications_professional on applications(professional_id);
