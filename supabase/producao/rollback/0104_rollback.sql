-- Rollback da 0104: remove a tabela de interesse de parceria (perde os contatos recebidos).
begin;
drop table if exists public.parceiros_interesse;
delete from supabase_migrations.schema_migrations where version = '20261011000104';
commit;
