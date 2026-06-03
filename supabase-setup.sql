-- ═══════════════════════════════════════════════════════════
--  BIKCO — Setup de RLS, trigger e realtime
--  Rode TUDO de uma vez no Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
--  STORAGE: bucket de fotos/vídeos dos pedidos (fotos da barra)
--  Cria o bucket público e libera upload p/ anon + logado.
-- ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('demand-media', 'demand-media', true)
on conflict (id) do nothing;

drop policy if exists "demand_media_insert" on storage.objects;
create policy "demand_media_insert" on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'demand-media');

drop policy if exists "demand_media_select" on storage.objects;
create policy "demand_media_select" on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'demand-media');

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

-- demands: o dono (logado) pode atualizar o próprio pedido — encerrar, editar status
drop policy if exists "demands_update_owner" on demands;
create policy "demands_update_owner" on demands for update
  to authenticated
  using (auth.uid() = (select auth_id from users where id = user_id))
  with check (auth.uid() = (select auth_id from users where id = user_id));

-- ───────────────────────────────────────────────────────────
--  SEGURANÇA: a tabela "users" guarda EMAIL e TELEFONE.
--  NUNCA exponha a tabela inteira publicamente. Use uma VIEW só
--  com campos seguros para exibir nome/avatar no feed e cards.
-- ───────────────────────────────────────────────────────────
alter table users enable row level security;

-- view pública: SOMENTE campos seguros (sem email, sem telefone)
create or replace view public.user_public as
  select id, username, full_name, avatar_url from public.users;
grant select on public.user_public to anon, authenticated;

-- remove o vazamento antigo (lia email/telefone de todos)
drop policy if exists "users_select_public" on users;

-- users: cada um lê apenas a PRÓPRIA linha
drop policy if exists "users_select_own" on users;
create policy "users_select_own" on users for select to authenticated
  using (auth.uid() = auth_id);

-- users: o dono de um pedido pode ler os dados (incl. telefone) de quem se candidatou a ELE
drop policy if exists "users_select_demand_owner" on users;
create policy "users_select_demand_owner" on users for select to authenticated
  using (exists (
    select 1 from applications a join demands d on d.id = a.demand_id
    where a.professional_id = users.id
      and d.user_id = (select u2.id from users u2 where u2.auth_id = auth.uid())
  ));

-- users: criar a própria linha no cadastro (callback de login)
drop policy if exists "users_insert_own" on users;
create policy "users_insert_own" on users for insert to authenticated
  with check (auth.uid() = auth_id);

-- ───────────────────────────────────────────────────────────
--  SEGURANÇA: tabela legada "profiles" também tinha email, phone
--  e whatsapp públicos. Trava por coluna: libera só campos seguros.
-- ───────────────────────────────────────────────────────────
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, bio, city, state, type, score, seal,
              verified, skills, cover_url, concluidos, created_at)
  on public.profiles to anon, authenticated;

-- professional_profiles: leitura pública (busca de profissionais)
drop policy if exists "profiles_select_public" on professional_profiles;
create policy "profiles_select_public" on professional_profiles for select
  to anon, authenticated
  using (true);

-- professional_profiles: o dono pode criar/editar o próprio perfil (chat de onboarding)
drop policy if exists "profiles_insert_own" on professional_profiles;
create policy "profiles_insert_own" on professional_profiles for insert
  to authenticated
  with check (auth.uid() = (select auth_id from users where id = user_id));

drop policy if exists "profiles_update_own" on professional_profiles;
create policy "profiles_update_own" on professional_profiles for update
  to authenticated
  using (auth.uid() = (select auth_id from users where id = user_id))
  with check (auth.uid() = (select auth_id from users where id = user_id));

-- users: o próprio usuário pode atualizar seu cadastro (nome, bio)
drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users for update
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

-- ───────────────────────────────────────────────────────────
--  ÁUDIO de apresentação no perfil profissional
-- ───────────────────────────────────────────────────────────
alter table professional_profiles add column if not exists audio_url text;

-- ───────────────────────────────────────────────────────────
--  VERIFICAÇÃO (CPF / RG) — DADO SENSÍVEL E PRIVADO.
--  Tabela separada: SOMENTE o próprio dono lê/escreve. Ninguém mais —
--  nem o contratante, nem o público — enxerga CPF/RG. Não fica no
--  "users" justamente para o dono do pedido NÃO ler o CPF do candidato.
-- ───────────────────────────────────────────────────────────
create table if not exists user_verification (
  user_id    uuid primary key references users(id) on delete cascade,
  cpf        text,
  rg         text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_verification enable row level security;

drop policy if exists "uv_select_own" on user_verification;
create policy "uv_select_own" on user_verification for select to authenticated
  using (auth.uid() = (select auth_id from users where id = user_id));

drop policy if exists "uv_insert_own" on user_verification;
create policy "uv_insert_own" on user_verification for insert to authenticated
  with check (auth.uid() = (select auth_id from users where id = user_id));

drop policy if exists "uv_update_own" on user_verification;
create policy "uv_update_own" on user_verification for update to authenticated
  using (auth.uid() = (select auth_id from users where id = user_id))
  with check (auth.uid() = (select auth_id from users where id = user_id));

-- garante que anon/authenticated não tenham GRANT amplo nessa tabela
revoke all on public.user_verification from anon;

-- ───────────────────────────────────────────────────────────
--  REALTIME — habilita o feed "ao vivo" (idempotente, não dá erro se já adicionado)
-- ───────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['demands','applications','messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

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

-- profissional pode se candidatar — MAS NÃO ao próprio pedido
drop policy if exists "applications_insert" on applications;
create policy "applications_insert" on applications for insert
  with check (
    auth.uid() = (select auth_id from users where id = professional_id)
    and professional_id is distinct from (select user_id from demands where id = demand_id)
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
