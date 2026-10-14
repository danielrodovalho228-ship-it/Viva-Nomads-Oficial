-- Viva Nomads — aplicar 0125 (SELECT por coluna: pets_regras, câmeras e acesso). Idempotente (grant repetido não muda nada).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0125_rollback.sql.
begin;
set local lock_timeout = '5s';

grant select (pets_regras, sem_cameras_interior, cameras_externas, tipo_acesso, senha_trocada_estadia)
  on public.properties to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000125', '0125_grant_select_pets_cameras_acesso',
       array['-- conteúdo em supabase/migrations/0125_grant_select_pets_cameras_acesso.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000125');
commit;
