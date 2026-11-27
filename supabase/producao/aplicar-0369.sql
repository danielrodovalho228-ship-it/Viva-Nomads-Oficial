-- Viva Nomads — aplicar 0369 (E1238: o prazo da janela da conferência gravado na conferência). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Não grava nem muda conferência nenhuma.
-- Rollback: supabase/producao/rollback/0369_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.conferencias add column if not exists prazo_em timestamptz;
comment on column public.conferencias.prazo_em is 'E1238: o fim da janela de 48 h, gravado quando a conferência nasce (a hora das instruções de entrada nesse momento). Vazio nas conferências de antes da 0369.';

insert into supabase_migrations.schema_migrations (version, name)
select '20261127000369', '0369_prazo'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261127000369');
commit;
