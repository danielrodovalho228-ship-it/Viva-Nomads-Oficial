-- Rollback da 0195: devolve o EXECUTE a authenticated (estado anterior).
begin;
grant execute on function public.admin_financeiro(date, date, text) to authenticated;
grant execute on function public.admin_financeiro_recorte(date, date, text, text) to authenticated;
grant execute on function public.admin_visao_geral(date, date, text) to authenticated;
grant execute on function public.admin_atendimento_metricas(integer) to authenticated;
grant execute on function public.marcar_fundador(uuid) to authenticated;
delete from supabase_migrations.schema_migrations where version = '20261020000195';
commit;
