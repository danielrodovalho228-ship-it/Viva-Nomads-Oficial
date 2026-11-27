-- Rollback da 0298 (E482): tira a linha de texto dos avisos do sino (o código lê sem ela e volta a mostrar só o título).
begin;
alter table public.avisos drop constraint if exists avisos_texto_curto;
alter table public.avisos drop column if exists texto;
delete from supabase_migrations.schema_migrations where version = '20261105000298';
commit;
