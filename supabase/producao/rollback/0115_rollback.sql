-- Rollback da 0115: apaga a tabela de códigos (a assinatura volta a não exigir código; reverta também o commit).
begin;
drop table if exists public.contrato_assinatura_codigos;
delete from supabase_migrations.schema_migrations where version = '20261014000115';
commit;
