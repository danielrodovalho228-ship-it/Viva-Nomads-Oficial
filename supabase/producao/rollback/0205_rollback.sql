-- Viva Nomads — rollback da 0205 (Internet medida no imóvel, Prompt 57). Idempotente.
-- Apaga as medições e a leitura pública. properties.internet_mbps (o informado pelo dono) não é tocado.
begin;
set local lock_timeout = '5s';
drop view if exists public.internet_medida_publica;
drop function if exists public.internet_medida_publica_lista();
drop table if exists public.internet_medicoes;
delete from supabase_migrations.schema_migrations where version = '20261022000205';
commit;
