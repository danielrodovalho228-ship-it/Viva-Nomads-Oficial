-- Rollback da 0272: não há desfazer de dado (reaplicaria as provas revogadas pelo Muse). Só tira o registro.
begin;
delete from supabase_migrations.schema_migrations where version = '20261031000272';
commit;
