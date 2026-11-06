-- Viva Nomads — aplicar 0309 (E640 (b): foto repetida no cadastro). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0309_rollback.sql.
begin;
set local lock_timeout = '5s';

-- E640 (b): coluna nova em properties (nula para todos), tabela nova (só admin lê) e a função de consulta (só service_role).
-- Não altera nenhum dado existente. Conteúdo completo e comentários em supabase/migrations/0309_foto_repetida_e640.sql.
alter table public.properties add column if not exists foto_repetida_em timestamptz;

create table if not exists public.fotos_repetidas_alertas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null,
  caminho text not null check (char_length(caminho) <= 200),
  outro_owner_id uuid not null,
  outro_property_id uuid,
  outro_caminho text not null check (char_length(outro_caminho) <= 200),
  distancia smallint not null check (distancia between 0 and 64),
  status text not null default 'aberto' check (status in ('aberto', 'liberado')),
  criado_em timestamptz not null default now(),
  liberado_em timestamptz,
  liberado_por uuid references public.profiles (id) on delete set null,
  constraint fotos_repetidas_alertas_liberado check (status = 'aberto' or liberado_em is not null)
);
create unique index if not exists fotos_repetidas_alertas_par_idx on public.fotos_repetidas_alertas (property_id, caminho, outro_caminho);
create index if not exists fotos_repetidas_alertas_abertos_idx on public.fotos_repetidas_alertas (criado_em) where status = 'aberto';

alter table public.fotos_repetidas_alertas enable row level security;
revoke all on public.fotos_repetidas_alertas from anon, authenticated;
grant select on public.fotos_repetidas_alertas to authenticated;
drop policy if exists "fotos_repetidas_alertas: só admin lê" on public.fotos_repetidas_alertas;
create policy "fotos_repetidas_alertas: só admin lê" on public.fotos_repetidas_alertas for select to authenticated using (public.is_admin());

create or replace function public.fotos_parecidas(p_property uuid, p_max int default 6)
returns table (caminho text, outro_caminho text, outro_owner uuid, outro_property uuid, distancia int)
language sql
stable
security definer
set search_path = public
as $$
  select a.caminho, b.caminho, b.owner_id, b.property_id,
         bit_count((('x' || a.hash)::bit(64)) # (('x' || b.hash)::bit(64)))::int
    from public.fotos_anuncio_hash a
    join public.fotos_anuncio_hash b on b.owner_id <> a.owner_id and b.caminho <> a.caminho
    join public.profiles pa on pa.id = a.owner_id and coalesce(pa.is_teste, false) = false
    join public.profiles pb on pb.id = b.owner_id and coalesce(pb.is_teste, false) = false
   where a.property_id = p_property
     and bit_count((('x' || a.hash)::bit(64)) # (('x' || b.hash)::bit(64))) <= p_max
$$;
revoke all on function public.fotos_parecidas(uuid, int) from public, anon, authenticated;
grant execute on function public.fotos_parecidas(uuid, int) to service_role;
comment on table public.fotos_repetidas_alertas is 'E640 (b): fotos de anúncio iguais às de outro anúncio de outra conta real. Só o admin lê; só o servidor grava.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000309', '0309_foto_repetida_e640', array['-- conteúdo em supabase/migrations/0309_foto_repetida_e640.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000309');
commit;
