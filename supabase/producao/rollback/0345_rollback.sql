-- Rollback da 0345: some a coluna do estado da noite (as contagens da linha ficam intactas).
-- O consolidar do laboratorio.yml grava a coluna num comando à parte e segue sem ela: não é preciso mexer no workflow antes.
begin;
alter table public.lab_execucoes drop column if exists noite;
delete from supabase_migrations.schema_migrations where version = '20261117000345';
commit;
