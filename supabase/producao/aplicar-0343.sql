-- Viva Nomads — aplicar 0343 (E872: RLS ligado na tabela de backup _bkp_0176_contratos_encerrados). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. NÃO apaga a tabela nem linha nenhuma.
-- Rollback: supabase/producao/rollback/0343_rollback.sql (só desliga o RLS; a tabela fica).
begin;
set local lock_timeout = '5s';

-- Se a tabela não existir (base nova sem a 0176), não há o que proteger: segue sem erro.
alter table if exists public._bkp_0176_contratos_encerrados enable row level security;
do $$
begin
  if to_regclass('public._bkp_0176_contratos_encerrados') is not null then
    revoke all on table public._bkp_0176_contratos_encerrados from anon, authenticated;
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261113000343', '0343_rls_bkp_0176'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261113000343');
commit;
