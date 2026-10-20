-- Rollback da 0169: remove o telefone opcional do visitante no chamado (apaga os telefones guardados).
begin;
alter table public.chamados drop constraint if exists chamados_visitante_telefone_formato;
alter table public.chamados drop column if exists visitante_telefone;
delete from supabase_migrations.schema_migrations where version = '20261019000169';
commit;
