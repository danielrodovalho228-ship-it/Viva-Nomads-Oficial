-- Rollback da 0194: remove as funções (o código volta a depender de 0113 + a versão anterior do app).
begin;
drop function if exists public.consumir_codigo_recuperacao(uuid, text);
drop function if exists public.trocar_codigos_recuperacao(uuid, text[]);
delete from supabase_migrations.schema_migrations where version = '20261020000194';
commit;
