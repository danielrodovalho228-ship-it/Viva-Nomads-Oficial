-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0055 (p1_dados_documentos_chamados_exclusao). Volta ao estado
-- anterior (políticas da 0006/0008). ⚠️ Reabre F1 (documento/chamado em imóvel
-- alheio). A página pública de exclusão de conta deixa de enviar o link até a
-- 0055 voltar (o código novo falha FECHADO sem a tabela/RPC).
-- Rode tudo de uma vez no SQL Editor (é uma transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

drop policy if exists "documentos do proprietário" on public.documents;
create policy "documentos do proprietário" on public.documents
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "inquilino abre chamado" on public.service_orders;
create policy "inquilino abre chamado" on public.service_orders
  for insert with check (tenant_id = auth.uid());

drop policy if exists "proprietário atualiza status" on public.service_orders;
create policy "proprietário atualiza status" on public.service_orders
  for update using (owner_id = auth.uid());

drop function if exists public.uid_por_email_exato(text);
drop table if exists public.exclusao_conta_pedidos;

commit;
