-- Viva Nomads — rollback da 0231 (triagem do morador: vínculo — Prompt 52). Idempotente. As linhas somem; os arquivos do
-- bucket triagem-vinculos precisam ser apagados pelo painel do Storage antes de remover o bucket (o Supabase não deixa
-- apagar bucket com objetos por SQL).
begin;
set local lock_timeout = '5s';
drop table if exists public.triagem_vinculos;
delete from supabase_migrations.schema_migrations where version = '20261023000231';
commit;
