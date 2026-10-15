-- Viva Nomads — aplicar 0133 (perfil_publico_dono só para o servidor). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0133_rollback.sql.
begin;
set local lock_timeout = '5s';

-- A função é SECURITY DEFINER: com execute para anon, qualquer um a chamaria direto na API.
-- Agora só o service_role executa; o servidor chama pelo cliente admin. Sem apagar dado.
revoke all on function public.perfil_publico_dono(uuid) from public, anon, authenticated;
grant execute on function public.perfil_publico_dono(uuid) to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261015000133', '0133_perfil_publico_dono_so_servidor',
       array['-- conteúdo em supabase/migrations/0133_perfil_publico_dono_so_servidor.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261015000133');
commit;
