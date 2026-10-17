-- Rollback da 0135: tira os gatilhos e a coluna is_teste (chamados já marcados como simulação continuam assim).
begin;
drop trigger if exists chamados_conta_de_teste_tg on public.chamados;
drop function if exists public.chamados_conta_de_teste();
drop trigger if exists profiles_is_teste_guarda on public.profiles;
drop function if exists public.profiles_is_teste_so_servidor();
alter table public.profiles drop column if exists is_teste;
delete from supabase_migrations.schema_migrations where version = '20261016000135';
commit;
