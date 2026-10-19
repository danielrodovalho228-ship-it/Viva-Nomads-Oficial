-- Rollback da 0171: remove a taxa fixada no envio (o aceite volta a usar só a faixa atual).
begin;
alter table public.propostas drop constraint if exists propostas_taxa_no_envio_valida;
alter table public.propostas drop column if exists taxa_no_envio;
delete from supabase_migrations.schema_migrations where version = '20261019000171';
commit;
