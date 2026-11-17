-- Viva Nomads — aplicar 0345 (E744, T4: estado da noite do laboratório em lab_execucoes). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0345_rollback.sql.
begin;
set local lock_timeout = '5s';

-- Cada rodada do laboratório grava se foi uma noite verde, os motivos quando não foi, a sequência de noites verdes e os
-- números por classe (falhou, conhecida, quarentena, instável, sem disposição). Linhas antigas ficam com null.
alter table public.lab_execucoes add column if not exists noite jsonb;
comment on column public.lab_execucoes.noite is 'Estado da rodada (verde/vermelha), motivos, sequência de noites verdes e números por classe (E744, T4).';

insert into supabase_migrations.schema_migrations (version, name)
select '20261117000345', '0345_lab_execucoes_noite'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261117000345');
commit;
