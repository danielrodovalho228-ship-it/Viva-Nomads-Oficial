-- Viva Nomads — aplicar 0350 (E1077). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- E1077 (ORDEM-DUET-369, decisão do Daniel de 21/11/2026): a avaliação do imóvel em âmbito de TESTE. Com a chave
-- VISTORIA_ATIVA desligada, só as contas desta lista veem e usam o fluxo (src/lib/vistoria/chave.ts). A lista nasce
-- VAZIA: as contas da prova do Gerente entram primeiro; as do Rogério e da esposa só depois dela. Entrar na lista não
-- envia convite nem aviso. Não toca no credenciamento nem na chave do lançamento público.
-- Rollback: supabase/producao/rollback/0350_rollback.sql
begin;
set local lock_timeout = '5s';

create table if not exists public.vistoria_piloto (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nota text check (nota is null or char_length(nota) <= 200),
  criado_em timestamptz not null default now()
);
alter table public.vistoria_piloto enable row level security;
revoke all on public.vistoria_piloto from public, anon, authenticated;
grant all on public.vistoria_piloto to service_role;

-- A conta da sessão está no piloto? Só responde sobre a própria conta (auth.uid()); não lista ninguém.
create or replace function public.vistoria_no_piloto()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vistoria_piloto p where p.user_id = auth.uid())
$$;
revoke all on function public.vistoria_no_piloto() from public, anon;
grant execute on function public.vistoria_no_piloto() to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
select '20261121000350', '0350_vistoria_piloto_e1077'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261121000350');
commit;
