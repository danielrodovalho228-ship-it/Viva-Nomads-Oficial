-- Rollback da 0164: tira a regra "trocou nome ou CPF → reverificar a identidade".
begin;
drop trigger if exists caf_reverificar_por_troca on public.profiles;
drop function if exists public.caf_reverificar_por_troca();
delete from supabase_migrations.schema_migrations where version = '20261018000164';
commit;
