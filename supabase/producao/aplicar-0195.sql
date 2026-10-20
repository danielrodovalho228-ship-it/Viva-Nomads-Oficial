-- Viva Nomads — aplicar 0195 (revogar EXECUTE de authenticated nas funções só de admin, ordem c9f6d762).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0195_rollback.sql.
begin;
set local lock_timeout = '5s';

revoke all on function public.admin_financeiro(date, date, text) from public, anon, authenticated;
grant execute on function public.admin_financeiro(date, date, text) to service_role;
revoke all on function public.admin_financeiro_recorte(date, date, text, text) from public, anon, authenticated;
grant execute on function public.admin_financeiro_recorte(date, date, text, text) to service_role;
revoke all on function public.admin_visao_geral(date, date, text) from public, anon, authenticated;
grant execute on function public.admin_visao_geral(date, date, text) to service_role;
revoke all on function public.admin_atendimento_metricas(integer) from public, anon, authenticated;
grant execute on function public.admin_atendimento_metricas(integer) to service_role;
revoke all on function public.marcar_fundador(uuid) from public, anon, authenticated;
grant execute on function public.marcar_fundador(uuid) to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261020000195', '0195_revogar_execute_admin',
       array['-- conteúdo em supabase/migrations/0195_revogar_execute_admin.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261020000195');
commit;
