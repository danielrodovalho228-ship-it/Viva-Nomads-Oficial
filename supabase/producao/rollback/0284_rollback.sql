-- Rollback da 0284 (antes, voltar o código que grava essas colunas).
begin;
alter table public.emails_teste drop column if exists html;
alter table public.emails_teste drop column if exists destinatario;
alter table public.emails_teste drop column if exists descadastro_url;
delete from supabase_migrations.schema_migrations where version = '20261102000284';
commit;
