-- Viva Nomads — aplicar 0128 (data de entrada desejada na candidatura, F37). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0128_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.leads add column if not exists inicio_desejado date;
comment on column public.leads.inicio_desejado is 'Data de entrada desejada, informada pelo inquilino na candidatura. Opcional; só sugere a data do Fechamento.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261015000128', '0128_leads_inicio_desejado',
       array['-- conteúdo em supabase/migrations/0128_leads_inicio_desejado.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000128');
commit;
