-- Rollback da 0082
begin;
delete from public.agentes_rondas where agente_slug = 'renato';
delete from public.agentes_ordens where agente_slug = 'renato';
delete from public.agentes where slug = 'renato';
delete from supabase_migrations.schema_migrations where version = '20261007000082';
commit;
