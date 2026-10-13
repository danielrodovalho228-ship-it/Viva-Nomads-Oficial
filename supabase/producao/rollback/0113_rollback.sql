-- Rollback da 0113: apaga as tabelas de códigos de recuperação (quem as usa volta ao 2FA só com o app).
begin;
drop table if exists public.mfa_controle;
drop table if exists public.mfa_codigos_recuperacao;
delete from supabase_migrations.schema_migrations where version = '20261013000113';
commit;
