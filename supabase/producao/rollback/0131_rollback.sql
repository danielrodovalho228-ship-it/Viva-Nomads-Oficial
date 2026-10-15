-- Rollback da 0131: remove a função de perfil público do dono (a página volta a não mostrar o bloco ao visitante).
begin;
drop function if exists public.perfil_publico_dono(uuid);
delete from supabase_migrations.schema_migrations where version = '20261015000131';
commit;
