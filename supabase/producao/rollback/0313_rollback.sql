-- Rollback da 0313 (E648). As colunas são aditivas e inofensivas: desfazer = desregistrar e (se quiser) removê-las.
-- Só rode o drop se NENHUM pedido/laudo novo tiver usado a escolha do dono (VISTORIA_ATIVA está desligada).
begin;
alter table public.vistoria_laudos drop column if exists assinado_por, drop column if exists assinado_em, drop column if exists assinatura_hash, drop column if exists assinatura_termo;
alter table public.vistoria_pedidos drop column if exists escolhido_em, drop column if exists valor_proposto, drop column if exists prazo_proposto_dias, drop column if exists proposta_em, drop column if exists proposta_aceita_em;
alter table public.avaliadores_credenciamento drop column if exists criterio_descredenciamento, drop column if exists resposta_ate, drop column if exists resposta_avaliador;
delete from public.vistoria_fila_admin where tipo = 'revisao_criterio';
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento'));
delete from supabase_migrations.schema_migrations where version = '20261106000313';
commit;
