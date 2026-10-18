-- Viva Nomads — aplicar 0152 (conferência automática do documento, cache de proximidades por CEP, negociação no anúncio). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0152_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.qualification_checklists
  add column if not exists conferencia jsonb,
  add column if not exists conferido_por text,
  add column if not exists revisao_ate timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'qualification_conferido_por_valido') then
    alter table public.qualification_checklists
      add constraint qualification_conferido_por_valido check (conferido_por is null or conferido_por in ('automatico', 'equipe'));
  end if;
end $$;

-- Quem não é o servidor não grava a trilha da conferência (nem forja um "automático").
create or replace function public.qualificacao_conferencia_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.conferencia := null;
    new.conferido_por := null;
    new.revisao_ate := null;
  elsif new.conferencia is distinct from old.conferencia
     or new.conferido_por is distinct from old.conferido_por
     or new.revisao_ate is distinct from old.revisao_ate then
    if not public.is_admin() then
      raise exception 'Somente a equipe Viva Nomads altera a conferência' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists qualificacao_conferencia_servidor on public.qualification_checklists;
create trigger qualificacao_conferencia_servidor
  before insert or update on public.qualification_checklists
  for each row execute function public.qualificacao_conferencia_servidor();

create index if not exists qualification_conferido_por_idx
  on public.qualification_checklists (conferido_por, created_at desc)
  where conferido_por is not null;

create table if not exists public.proximidades_cep (
  cep text primary key check (cep ~ '^[0-9]{8}$'),
  lat double precision,
  lng double precision,
  itens jsonb not null default '[]'::jsonb,
  fonte text not null default 'osm',
  atualizado_em timestamptz not null default now()
);
alter table public.proximidades_cep enable row level security;
revoke all on public.proximidades_cep from anon, authenticated;

alter table public.properties
  add column if not exists negociacao jsonb,
  add column if not exists internet_mbps integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_internet_mbps_faixa') then
    alter table public.properties
      add constraint properties_internet_mbps_faixa check (internet_mbps is null or internet_mbps between 1 and 10000);
  end if;
end $$;

comment on column public.properties.negociacao is
  'Negociação pública do anúncio: {aceita, itens[], descontos[{mesesMin, pct}]}. Validada em src/lib/anuncio/negociacao.ts.';

-- Leitura pública (a 0053 deixou o SELECT de properties por coluna).
grant select (negociacao, internet_mbps) on public.properties to anon, authenticated;

create table if not exists public.property_negociacao_limites (
  property_id uuid primary key references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  valor_minimo numeric(12, 2) check (valor_minimo is null or valor_minimo > 0),
  limpezas_max integer check (limpezas_max is null or limpezas_max between 0 and 8),
  atualizado_em timestamptz not null default now()
);
alter table public.property_negociacao_limites enable row level security;
revoke all on public.property_negociacao_limites from anon;
grant select, insert, update, delete on public.property_negociacao_limites to authenticated;

drop policy if exists negociacao_limites_dono on public.property_negociacao_limites;
create policy negociacao_limites_dono on public.property_negociacao_limites
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))
  );

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000152', '0152_cadastro_conferencia_negociacao',
       array['-- conteúdo em supabase/migrations/0152_cadastro_conferencia_negociacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000152');
commit;
