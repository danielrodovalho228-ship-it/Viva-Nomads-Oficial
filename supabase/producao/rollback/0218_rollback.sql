-- Viva Nomads — rollback da 0218 (59-C1). Idempotente.
-- Volta a restrição para NOT VALID (como a 0200 deixou). O dado NÃO volta: "próprio com sublocação" é o estado proibido.
begin;
set local lock_timeout = '5s';
alter table public.properties drop constraint if exists properties_proprio_sem_sublocacao;
alter table public.properties
  add constraint properties_proprio_sem_sublocacao
  check (ownership_type <> 'own' or sublease_authorized is not true) not valid;
delete from supabase_migrations.schema_migrations where version = '20261023000218';
commit;
