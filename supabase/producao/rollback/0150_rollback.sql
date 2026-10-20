-- Rollback da 0150 (verificação de telefone). A função do perfil (0149) não é tocada pela 0150.
begin;
set local lock_timeout = '5s';
drop function if exists public.telefones_verificados(uuid[]);
drop function if exists public.telefone_em_uso(text, uuid);
drop table if exists public.telefone_verificacao;
delete from supabase_migrations.schema_migrations where version = '20261017000150';
commit;
