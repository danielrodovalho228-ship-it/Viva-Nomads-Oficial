-- Viva Nomads — aplicar 0279 (E399-C pacote 1: link do Airbnb, só o número do anúncio). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0279_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.preco_justo_airbnb (
  property_id uuid primary key references public.properties(id) on delete cascade,
  airbnb_id text not null check (airbnb_id ~ '^[0-9]{3,20}$'),
  informado_em timestamptz not null default now(),
  conferencia text not null default 'pendente' check (conferencia in ('pendente', 'confere', 'diverge')),
  divergencias text[] not null default '{}',
  conferido_em timestamptz,
  fonte text not null default 'simulada',
  atualizado_em timestamptz not null default now()
);

comment on table public.preco_justo_airbnb is
  'E399-C: número do anúncio no Airbnb (nunca o link) e a conferência antifraude (cidade e quartos). Só o servidor lê.';

alter table public.preco_justo_airbnb enable row level security;
revoke all on public.preco_justo_airbnb from anon, authenticated;

create index if not exists preco_justo_airbnb_diverge_idx on public.preco_justo_airbnb (conferido_em) where conferencia = 'diverge';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000279', '0279_preco_justo_link_airbnb', array['-- conteúdo em supabase/migrations/0279_preco_justo_link_airbnb.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000279');
commit;
