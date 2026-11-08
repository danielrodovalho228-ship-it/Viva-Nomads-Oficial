-- Viva Nomads — aplicar 0332 (E721: índice único completo em push_adiados (user_id, grupo)). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0332_rollback.sql.
begin;
set local lock_timeout = '5s';

create unique index if not exists push_adiados_user_grupo on public.push_adiados (user_id, grupo);
drop index if exists public.push_adiados_grupo;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000332', '0332_push_adiados_indice_unico_e721', array['-- conteúdo em supabase/migrations/0332_push_adiados_indice_unico_e721.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000332');
commit;
