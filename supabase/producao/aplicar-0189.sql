-- Viva Nomads — aplicar 0189 (política dos ignorados só para authenticated). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0189_rollback.sql.
begin;
set local lock_timeout = '5s';

alter policy "dono gerencia seus ignorados" on public.pedidos_ignorados to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000189', '0189_politica_ignorados_authenticated',
       array['-- conteúdo em supabase/migrations/0189_politica_ignorados_authenticated.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000189');
commit;
