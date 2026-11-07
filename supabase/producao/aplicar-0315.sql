-- Viva Nomads — aplicar 0315 (E657: candidatura reenviada guarda reenviada_em). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0315_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.leads
  add column if not exists reenviada_em timestamptz;

comment on column public.leads.reenviada_em is 'Quando a candidatura foi reenviada (E581/E657); null = nunca reenviada (vale created_at).';

grant select (reenviada_em) on public.leads to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000315', '0315_candidatura_reenviada_em_e657', array['-- conteúdo em supabase/migrations/0315_candidatura_reenviada_em_e657.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000315');

commit;
