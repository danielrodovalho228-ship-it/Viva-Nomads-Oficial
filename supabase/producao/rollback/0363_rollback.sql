-- Viva Nomads — desfazer a 0363 (E1179: a fila da equipe aceita os quatro tipos do laudo). Volta a regra aos seis tipos
-- da 0362. Se houver itens dos tipos 'laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida' ou 'seguranca_grave',
-- resolvidos ou não, a regra antiga não os aceita e este script para sem mudar nada: decida antes o que fazer com eles.
begin;
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador'));
delete from supabase_migrations.schema_migrations where version = '20261124000363';
commit;
