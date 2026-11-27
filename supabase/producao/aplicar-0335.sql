-- Viva Nomads — aplicar 0335 (E690: avaliador decidido pelo sistema). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0335_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.avaliadores_credenciamento add column if not exists decidido_pelo_sistema boolean not null default false;
alter table public.avaliadores_credenciamento add column if not exists criterios_decisao jsonb;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000335', '0335_avaliador_decidido_pelo_sistema_e690', array['-- conteúdo em supabase/migrations/0335_avaliador_decidido_pelo_sistema_e690.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000335');
commit;
