-- Viva Nomads — aplicar 0147 (SELECT público de properties.limpeza_estadia). Idempotente (grant repetido não muda nada).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0147_rollback.sql.
begin;
set local lock_timeout = '5s';
grant select (limpeza_estadia) on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261017000147', '0147_grant_limpeza_estadia',
       array['-- conteúdo em supabase/migrations/0147_grant_limpeza_estadia.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017000147');
commit;
