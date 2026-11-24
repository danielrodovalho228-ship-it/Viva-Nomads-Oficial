-- Viva Nomads — rollback da 0343: desliga o RLS da _bkp_0176_contratos_encerrados. A tabela e as linhas FICAM
-- (decisão do Daniel, 13/11/2026: não apagar em hipótese nenhuma). anon/authenticated seguem sem permissão (0176).
begin;
set local lock_timeout = '5s';
alter table if exists public._bkp_0176_contratos_encerrados disable row level security;
delete from supabase_migrations.schema_migrations where version = '20261113000343';
commit;
