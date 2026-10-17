-- Viva Nomads — rollback da 0144: remove o pacote de limpeza dos anúncios. Só use se o Daniel mandar.
begin;
set local lock_timeout = '5s';
alter table public.properties drop column if exists limpeza_estadia;
delete from supabase_migrations.schema_migrations where version = '20261016000144';
commit;
