-- Viva Nomads — rollback da 0226 (push só pela matriz — 44-B1). Idempotente. Os pushes adiados que ainda não saíram
-- são descartados (o e-mail e a central já foram entregues); a regra dos 10 min volta a não ter dado (todo push sai).
begin;
set local lock_timeout = '5s';
drop table if exists public.push_adiados;
drop table if exists public.conversa_aberturas;
delete from supabase_migrations.schema_migrations where version = '20261023000226';
commit;
