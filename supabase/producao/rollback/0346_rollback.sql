-- Viva Nomads — rollback da 0346 (E614): tira o gatilho, a função e a coluna properties.updated_at. Nunca roda sozinho.
-- A tela não quebra sem a coluna: o rascunho sem carimbo volta a usar só a hora da criação.
begin;
set local lock_timeout = '5s';
drop trigger if exists properties_updated_at on public.properties;
drop function if exists public.properties_carimbar_updated_at();
alter table public.properties drop column if exists updated_at;
delete from supabase_migrations.schema_migrations where version = '20261118000346';
commit;
