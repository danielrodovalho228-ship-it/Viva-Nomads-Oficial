-- Viva Nomads — rollback da 0355 (E1099): tira o campo "Sobre" do avaliador (o texto escrito perde-se). Nunca roda sozinho.
begin;
set local lock_timeout = '5s';
alter table public.avaliadores_credenciamento drop column if exists sobre;
delete from supabase_migrations.schema_migrations where version = '20261122000355';
commit;
