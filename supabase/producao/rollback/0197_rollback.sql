-- Rollback da 0197 (nunca roda sozinho). Apaga as avaliações de pedidos de parceiro e as colunas novas dos pedidos
-- (valores combinados, horários, pagamento simulado, documento do parceiro). O bucket parceiro-entregas fica (pode
-- ter arquivos: apague à mão depois de conferir). Pedidos em "em_execucao" voltam para "agendado".
begin;
drop function if exists public.publicar_avaliacoes_parceiro(uuid);
drop table if exists public.parceiro_avaliacoes;
update public.parceiro_pedidos set status = 'agendado' where status = 'em_execucao';
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_contratacao_check;
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_status_check;
alter table public.parceiro_pedidos add constraint parceiro_pedidos_status_check check (status in (
  'solicitado', 'orcado', 'aceito', 'agendado', 'entregue', 'concluido', 'recusado', 'cancelado'));
drop index if exists public.parceiro_pedidos_cliente_abertos;
drop index if exists public.parceiro_pedidos_agendados;
alter table public.parceiro_pedidos
  drop column if exists horarios_propostos, drop column if exists horario_confirmado, drop column if exists valor_combinado,
  drop column if exists taxa_percent, drop column if exists valor_taxa, drop column if exists valor_parceiro,
  drop column if exists pagamento_status, drop column if exists pagamento_ref, drop column if exists documento_parceiro_path,
  drop column if exists concluido_em, drop column if exists entregue_em, drop column if exists origem, drop column if exists motivo_recusa;
comment on table public.servicos_adicionais is null;
comment on table public.servicos_pedidos is null;
comment on table public.interesse_servico is null;
delete from supabase_migrations.schema_migrations where version = '20261021000197';
commit;
