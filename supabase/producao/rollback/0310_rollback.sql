-- Rollback da 0310 (E637): remove as duas tabelas novas (nada mais depende delas; a chave CAUCAO_PRAZOS_ATIVA está desligada).
begin;
drop table if exists public.caucao_desconto_itens;
drop table if exists public.caucao_prazos;
delete from supabase_migrations.schema_migrations where version = '20261105000310';
commit;
