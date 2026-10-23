-- Viva Nomads — rollback da 0221 (Sair da Viva — Prompt 51, fase 1). Idempotente.
-- Contas pausadas voltam a ativas (a coluna sai); os motivos, as correções e as denúncias são apagados.
begin;
set local lock_timeout = '5s';
drop table if exists public.denuncias_anuncio;
drop table if exists public.qualidade_correcoes;
drop table if exists public.saidas_motivos;
-- Só devolve o que a pausa tirou do ar, e só enquanto a coluna existe (rodar o rollback de novo não falha).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'pausado_pela_conta') then
    update public.properties set status = 'active' where pausado_pela_conta and status = 'paused';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'parceiros' and column_name = 'pausado_pela_conta') then
    update public.parceiros set status = 'publicado' where pausado_pela_conta and status = 'pausado';
  end if;
end $$;
alter table public.parceiros drop column if exists pausado_pela_conta;
alter table public.properties drop column if exists pausado_pela_conta;
alter table public.profiles drop column if exists pausada_em;
delete from supabase_migrations.schema_migrations where version = '20261023000221';
commit;
