-- Rollback da 0136: apaga a caixa de e-mails de teste (só contém e-mails de contas de teste).
begin;
drop policy if exists emails_teste_admin_le on public.emails_teste;
drop table if exists public.emails_teste;
delete from supabase_migrations.schema_migrations where version = '20261016000136';
commit;
