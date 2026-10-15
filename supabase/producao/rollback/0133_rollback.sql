-- Rollback da 0133: devolve o execute a anon/authenticated (estado da 0131).
begin;
grant execute on function public.perfil_publico_dono(uuid) to anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261015000133';
commit;
