-- Rollback da 0110: apaga as conferências de entrada/saída registradas (itens e respostas vão juntos).
begin;
drop table if exists public.conferencia_respostas;
drop table if exists public.conferencia_itens;
drop table if exists public.conferencias;
drop function if exists public.conferencia_respostas_imutavel();
drop function if exists public.conferencia_itens_trava();
delete from supabase_migrations.schema_migrations where version = '20261012000110';
commit;
