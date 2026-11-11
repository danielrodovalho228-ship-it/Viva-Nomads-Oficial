-- Viva Nomads — aplicar 0339 (12a8086d: aparelho da decisão nas aprovações). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0339_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.aprovacoes add column if not exists decidido_aparelho text
  check (decidido_aparelho is null or char_length(decidido_aparelho) <= 60);

comment on column public.aprovacoes.decidido_aparelho is
  'Resumo do aparelho da decisão (tipo · sistema · navegador). Sem user-agent cru e sem IP.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261111000339', '0339_aprovacoes_decidido_aparelho', array['-- conteúdo em supabase/migrations/0339_aprovacoes_decidido_aparelho.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261111000339');
commit;
