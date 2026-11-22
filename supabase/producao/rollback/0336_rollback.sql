-- Rollback da 0336: some a tabela de conversas adiadas (só preferência de visão; nenhuma mensagem é tocada).
begin;
drop table if exists public.conversas_adiadas;
delete from supabase_migrations.schema_migrations where version = '20261107000336';
commit;
