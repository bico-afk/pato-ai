-- ═══════════════════════════════════════════════════════════
--  BIKCO — Setup de RLS, trigger e realtime
--  Rode TUDO de uma vez no Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
--  CORRIGE: usuário anônimo só conseguia publicar 1 pedido.
--  A constraint UNIQUE em anonymous_token impedia o 2º pedido
--  do mesmo navegador. Um anônimo pode publicar vários pedidos.
-- ───────────────────────────────────────────────────────────
alter table demands drop constraint if exists demands_anonymous_token_key;

-- ───────────────────────────────────────────────────────────
--  LEITURA PÚBLICA (corrige "feed vazio quando logado")
--  O feed é público: anon E authenticated precisam ler.
--  Causa do bug: policy de SELECT existia só p/ role 'anon',
--  então usuários logados (role 'authenticated') viam ZERO.
-- ───────────────────────────────────────────────────────────

-- demands: qualquer um lê os pedidos abertos
drop policy if exists "demands_select_public" on demands;
create policy "demands_select_public" on demands for select
  to anon, authenticated
  using (true);

-- users: leitura pública de perfil básico (nome/avatar no feed e cards)
drop policy if exists "users_select_public" on users;
create policy "users_select_public" on users for select
  to anon, authenticated
  using (true);

-- professional_profiles: leitura pública (busca de profissionais)
drop policy if exists "profiles_select_public" on professional_profiles;
create policy "profiles_select_public" on professional_profiles for select
  to anon, authenticated
  using (true);

-- ───────────────────────────────────────────────────────────
--  REALTIME — habilita o feed "ao vivo"
-- ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table demands;
alter publication supabase_realtime add table applications;
alter publication supabase_realtime add table messages;

-- ───────────────────────────────────────────────────────────
--  APPLICATIONS (candidaturas)
-- ───────────────────────────────────────────────────────────

-- dono do pedido E o candidato podem ver
drop policy if exists "applications_select" on applications;
create policy "applications_select" on applications for select
  using (
    auth.uid() = (select auth_id from users where id = professional_id)
    or
    auth.uid() = (
      select u.auth_id from users u
      join demands d on d.user_id = u.id
      where d.id = demand_id
    )
  );

-- profissional pode se candidatar
drop policy if exists "applications_insert" on applications;
create policy "applications_insert" on applications for insert
  with check (
    auth.uid() = (select auth_id from users where id = professional_id)
  );

-- dono pode atualizar status (aceitar/recusar)
drop policy if exists "applications_update" on applications;
create policy "applications_update" on applications for update
  using (
    auth.uid() = (
      select u.auth_id from users u
      join demands d on d.user_id = u.id
      where d.id = demand_id
    )
  );

-- ───────────────────────────────────────────────────────────
--  CHATS
-- ───────────────────────────────────────────────────────────

drop policy if exists "chats_insert" on chats;
create policy "chats_insert" on chats for insert
  with check (auth.uid() = (select auth_id from users where id = client_id));

drop policy if exists "chats_select" on chats;
create policy "chats_select" on chats for select
  using (
    auth.uid() = (select auth_id from users where id = client_id)
    or
    auth.uid() = (select auth_id from users where id = professional_id)
  );

-- ───────────────────────────────────────────────────────────
--  MESSAGES
-- ───────────────────────────────────────────────────────────

drop policy if exists "messages_insert" on messages;
create policy "messages_insert" on messages for insert
  with check (
    auth.uid() in (
      select u.auth_id from users u
      join chats c on c.client_id = u.id or c.professional_id = u.id
      where c.id = chat_id
    )
  );

drop policy if exists "messages_select" on messages;
create policy "messages_select" on messages for select
  using (
    auth.uid() in (
      select u.auth_id from users u
      join chats c on c.client_id = u.id or c.professional_id = u.id
      where c.id = chat_id
    )
  );

-- ───────────────────────────────────────────────────────────
--  TRIGGER — contador de candidatos
-- ───────────────────────────────────────────────────────────

create or replace function increment_candidate_count()
returns trigger as $$
begin
  update demands set candidate_count = candidate_count + 1 where id = new.demand_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_increment_candidates on applications;
create trigger trigger_increment_candidates
  after insert on applications
  for each row execute function increment_candidate_count();
