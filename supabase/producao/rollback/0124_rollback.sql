-- Rollback da 0124: remove a coluna (o resumo volta a ler as regras do anúncio ao vivo).
begin;
alter table public.contratos drop column if exists pets_regras_congeladas;
delete from supabase_migrations.schema_migrations where version = '20261014000124';
commit;
