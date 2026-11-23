-- Viva Nomads — aplicar 0356 (12a8086d: aparelho da decisão nas aprovações). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0356_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.aprovacoes add column if not exists decidido_aparelho text
  check (decidido_aparelho is null or char_length(decidido_aparelho) <= 60);

comment on column public.aprovacoes.decidido_aparelho is
  'Resumo do aparelho da decisão (tipo · sistema · navegador). Sem user-agent cru e sem IP.';

insert into supabase_migrations.schema_migrations (version, name)
select '20261122000356', '0356_aprovacoes_decidido_aparelho'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261122000356');
commit;
