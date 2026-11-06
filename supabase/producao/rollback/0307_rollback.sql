-- Rollback da 0307 (E582): apaga só a candidatura da fixture (id fixo). Não toca perfil, CPF, anúncio nem contrato.
begin;
delete from public.leads where id = 'a0307000-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261105000307';
commit;
