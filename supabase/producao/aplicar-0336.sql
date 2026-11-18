-- Viva Nomads — aplicar 0336 (E721: conversas_adiadas, o "Adiar" da conversa). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0336_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E721: "Adiar" uma conversa em /dashboard/mensagens. O "adiar" que existia era só o do push (push_adiados, silêncio 22h–7h);
-- a ação da pessoa sobre a conversa nunca foi entregue. Estado por pessoa e por conversa: a conversa adiada sai da lista
-- principal até `ate` (ou até a outra parte escrever de novo) e fica no filtro "Adiadas". Cada lado adia a sua própria
-- visão; adiar não apaga nada nem avisa a outra parte. RLS: só as próprias linhas, e só de conversa de que é parte.
create table if not exists public.conversas_adiadas (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null,
  adiada_em timestamptz not null default now(),
  ate timestamptz not null,
  primary key (user_id, conversation_id)
);
create index if not exists conversas_adiadas_ate on public.conversas_adiadas (ate);

alter table public.conversas_adiadas enable row level security;
drop policy if exists conversas_adiadas_le_as_suas on public.conversas_adiadas;
create policy conversas_adiadas_le_as_suas on public.conversas_adiadas for select to authenticated using (user_id = auth.uid());
drop policy if exists conversas_adiadas_adia_as_suas on public.conversas_adiadas;
create policy conversas_adiadas_adia_as_suas on public.conversas_adiadas for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m where m.conversation_id = conversas_adiadas.conversation_id and (m.sender_id = auth.uid() or m.receiver_id = auth.uid()))
  );
drop policy if exists conversas_adiadas_muda_as_suas on public.conversas_adiadas;
create policy conversas_adiadas_muda_as_suas on public.conversas_adiadas for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists conversas_adiadas_retoma_as_suas on public.conversas_adiadas;
create policy conversas_adiadas_retoma_as_suas on public.conversas_adiadas for delete to authenticated using (user_id = auth.uid());
revoke all on public.conversas_adiadas from anon, authenticated;
grant select, insert, delete on public.conversas_adiadas to authenticated;
grant update (adiada_em, ate) on public.conversas_adiadas to authenticated;
grant all on public.conversas_adiadas to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000336', '0336_conversas_adiadas_e721', array['-- conteúdo em supabase/migrations/0336_conversas_adiadas_e721.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000336');
commit;
