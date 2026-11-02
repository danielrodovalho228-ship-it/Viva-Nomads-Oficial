-- Viva Nomads — aplicar 0286 (E444: caixa de avisos do site). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0286_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E444 (Relay 57, itens 1 e 2 — Pista B): caixa de avisos do site (o sino). Uma linha por aviso, gravada pelo notify()
-- junto do e-mail/push. Título só do catálogo de eventos (sem contato nem dado sensível). RLS: cada um lê e marca só
-- os seus; só o servidor (service_role) grava. "resolvido_em" é preenchido pelo servidor quando a ação do evento é feita.
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  evento text not null check (char_length(evento) between 1 and 60),
  prioridade text not null check (prioridade in ('critico', 'urgente', 'normal')),
  titulo text not null check (char_length(titulo) between 1 and 160),
  url text check (url is null or (url like '/%' and url not like '//%' and char_length(url) <= 300)),
  ref_id text check (ref_id is null or char_length(ref_id) <= 80),
  criado_em timestamptz not null default now(),
  lido_em timestamptz,
  resolvido_em timestamptz
);
create index if not exists avisos_usuario_recentes on public.avisos (usuario_id, criado_em desc);
create index if not exists avisos_usuario_nao_lidos on public.avisos (usuario_id) where lido_em is null;
create index if not exists avisos_pendentes_ref on public.avisos (usuario_id, evento, ref_id) where resolvido_em is null;

alter table public.avisos enable row level security;
drop policy if exists avisos_le_os_seus on public.avisos;
create policy avisos_le_os_seus on public.avisos for select to authenticated using (usuario_id = auth.uid());
drop policy if exists avisos_marca_os_seus on public.avisos;
create policy avisos_marca_os_seus on public.avisos for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
-- A pessoa só marca como lido (nunca muda título, prioridade, url nem "resolvido").
grant update (lido_em) on public.avisos to authenticated;
grant all on public.avisos to service_role;

-- Resumo do sino: não lidas e a maior prioridade ainda pendente (não lida e não resolvida). Só os do próprio usuário.
create or replace function public.avisos_resumo()
returns table (nao_lidas integer, maior_prioridade text)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where a.lido_em is null)::integer,
    (array_agg(a.prioridade order by case a.prioridade when 'critico' then 0 when 'urgente' then 1 else 2 end)
      filter (where a.lido_em is null and a.resolvido_em is null))[1]
  from public.avisos a
  where a.usuario_id = auth.uid()
$$;
revoke all on function public.avisos_resumo() from public, anon;
grant execute on function public.avisos_resumo() to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261102000286', '0286_avisos_site', array['-- conteúdo em supabase/migrations/0286_avisos_site.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261102000286');
commit;
