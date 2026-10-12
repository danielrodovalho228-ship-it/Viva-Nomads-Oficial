-- Viva Nomads — aplicar 0108 (assinaturas do contrato: duas colunas em contratos, só o servidor grava).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0108_rollback.sql (perde as datas de assinatura gravadas).
begin;
set local lock_timeout = '5s';

alter table public.contratos add column if not exists assinado_proprietario_em timestamptz;
alter table public.contratos add column if not exists assinado_inquilino_em timestamptz;

comment on column public.contratos.assinado_proprietario_em is 'Quando o proprietário assinou o contrato (NULL = ainda não assinou). Só o servidor grava.';
comment on column public.contratos.assinado_inquilino_em is 'Quando o inquilino assinou o contrato (NULL = ainda não assinou). Só o servidor grava.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261012000108', '0108_contrato_assinaturas',
       array['-- conteúdo em supabase/migrations/0108_contrato_assinaturas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261012000108');
commit;
