-- Habilitar Realtime nas tabelas principais
alter publication supabase_realtime add table demands;
alter publication supabase_realtime add table applications;

-- Trigger: incrementar candidate_count ao inserir candidatura
create or replace function increment_candidate_count()
returns trigger as $$
begin
  update demands
  set candidate_count = candidate_count + 1
  where id = new.demand_id;
  return new;
end;
$$ language plpgsql;

create trigger trigger_increment_candidates
  after insert on applications
  for each row execute function increment_candidate_count();
