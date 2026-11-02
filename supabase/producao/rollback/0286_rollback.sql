-- Viva Nomads — desfaz 0286 (E444: caixa de avisos do site). Apaga a tabela e a função; os avisos gravados somem.
begin;
drop function if exists public.avisos_resumo();
drop table if exists public.avisos;
delete from supabase_migrations.schema_migrations where version = '20261102000286';
commit;
