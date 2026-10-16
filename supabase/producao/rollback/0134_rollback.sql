-- Rollback da 0134: remove a tabela de marcas (as marcas "Visto"/"contatou" se perdem; nada mais depende dela).
begin;
drop table if exists public.imovel_marcas;
delete from supabase_migrations.schema_migrations where version = '20261016000134';
commit;
