-- Viva Nomads — aplicar 0124 (contratos.pets_regras_congeladas). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0124_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.contratos add column if not exists pets_regras_congeladas jsonb;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000124', '0124_contrato_pets_congeladas',
       array['-- conteúdo em supabase/migrations/0124_contrato_pets_congeladas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000124');
commit;
