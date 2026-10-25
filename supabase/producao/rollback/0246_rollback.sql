-- Viva Nomads — rollback da 0246: tira a leitura de QA das caixas de teste (política, guarda e coluna qa_leitor).
-- Idempotente. emails_teste, a política do admin e is_teste ficam como estavam.
begin;
set local lock_timeout = '5s';
drop policy if exists emails_teste_qa_leitor_le on public.emails_teste;
drop trigger if exists profiles_qa_leitor_guarda on public.profiles;
drop function if exists public.profiles_qa_leitor_so_servidor();
alter table public.profiles drop column if exists qa_leitor;
delete from supabase_migrations.schema_migrations where version = '20261024000246';
commit;
