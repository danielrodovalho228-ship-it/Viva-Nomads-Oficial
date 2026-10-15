-- Desfaz a 0128: remove a data de entrada desejada (só sugestão; nada depende dela para gravar contrato).
begin;
alter table public.leads drop column if exists inicio_desejado;
delete from supabase_migrations.schema_migrations where version = '20261015000128';
commit;
