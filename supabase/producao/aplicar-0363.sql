-- Viva Nomads — aplicar 0363 (E1179: a fila da equipe aceita os quatro tipos do laudo). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0363_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador', 'laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida', 'seguranca_grave'));

insert into supabase_migrations.schema_migrations (version, name)
select '20261124000363', '0363_vistoria_fila_admin_tipos_do_laudo_e1179'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261124000363');
commit;
