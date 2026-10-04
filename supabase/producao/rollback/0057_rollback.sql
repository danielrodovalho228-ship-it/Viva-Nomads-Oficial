-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0057 (p1_contratos_candidaturas_contato). Volta às regras
-- anteriores (0001/0017/0025/0026/0027/0029/0046 + insert de lead da 0052).
-- ⚠️ Reabre A6 (assinatura/contratos/pagamentos graváveis pelo usuário), A1
-- (dono reescreve candidatura e resposta) e A2 (contato só mascarado no código).
-- A coluna contratos.lead_id FICA (só dado). Rode tudo de uma vez (transação).
-- ════════════════════════════════════════════════════════════════════════════
begin;

drop policy if exists "dono lê a própria assinatura" on public.subscriptions;
drop policy if exists "assinatura do dono" on public.subscriptions;
create policy "assinatura do dono" on public.subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "inquilino cria contrato" on public.contratos;
create policy "inquilino cria contrato" on public.contratos for insert with check (tenant_id = auth.uid());
drop policy if exists "partes atualizam contrato" on public.contratos;
create policy "partes atualizam contrato" on public.contratos for update using (
  tenant_id = auth.uid()
  or exists (select 1 from public.properties p where p.id = contratos.property_id and p.owner_id = auth.uid()));
drop policy if exists "partes criam bloco" on public.contrato_blocos;
create policy "partes criam bloco" on public.contrato_blocos for insert with check (
  exists (select 1 from public.contratos c where c.id = contrato_blocos.contrato_id and (c.tenant_id = auth.uid()
    or exists (select 1 from public.properties p where p.id = c.property_id and p.owner_id = auth.uid()))));
drop policy if exists "partes atualizam bloco" on public.contrato_blocos;
create policy "partes atualizam bloco" on public.contrato_blocos for update using (
  exists (select 1 from public.contratos c where c.id = contrato_blocos.contrato_id and (c.tenant_id = auth.uid()
    or exists (select 1 from public.properties p where p.id = c.property_id and p.owner_id = auth.uid()))));

drop trigger if exists trg_pagamentos_confirmacao on public.pagamentos_bloco;
drop function if exists public.pagamentos_confirmacao();
revoke update (confirmado_pelo_inquilino) on public.pagamentos_bloco from authenticated;
grant update on public.pagamentos_bloco to authenticated;
drop policy if exists "inquilino confirma pagamento" on public.pagamentos_bloco;
create policy "inquilino confirma pagamento" on public.pagamentos_bloco for update using (
  exists (select 1 from public.contratos c where c.id = pagamentos_bloco.contrato_id and c.tenant_id = auth.uid()));
drop policy if exists "proprietário registra recebimento" on public.pagamentos_bloco;
create policy "proprietário registra recebimento" on public.pagamentos_bloco for insert with check (
  marcado_por = auth.uid()
  and exists (select 1 from public.contratos c join public.properties p on p.id = c.property_id
              where c.id = pagamentos_bloco.contrato_id and p.owner_id = auth.uid()));

drop policy if exists "inquilino cria locação" on public.locacoes;
create policy "inquilino cria locação" on public.locacoes for insert with check (tenant_id = auth.uid());

drop policy if exists "dono decide candidatura" on public.leads;
create policy "dono decide candidatura" on public.leads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inquilino cria lead" on public.leads;
create policy "inquilino cria lead" on public.leads
  for insert with check (
    tenant_id = auth.uid() and status = 'new'
    and exists (select 1 from public.properties p
                where p.id = leads.property_id and p.status = 'active' and p.owner_id = leads.owner_id));

drop trigger if exists trg_respostas_pedido_transicao on public.respostas_pedido;
drop function if exists public.respostas_pedido_transicao();
revoke update (status, recusa_motivo) on public.respostas_pedido from authenticated;
grant update on public.respostas_pedido to authenticated;
drop policy if exists "partes atualizam resposta" on public.respostas_pedido;
create policy "partes atualizam resposta" on public.respostas_pedido for update using (
  proprietario_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid()));

drop function if exists public.primeiros_nomes(uuid[]);

drop trigger if exists messages_mask_contact on public.messages;
drop function if exists public.trg_mask_body();
drop function if exists public.mask_contact(text);
drop trigger if exists contato_pedido_apresentacao on public.pedidos_moradia;
drop trigger if exists contato_resposta_mensagem on public.respostas_pedido;
drop trigger if exists contato_resposta_motivo on public.respostas_pedido;
drop trigger if exists contato_avaliacao_comentario on public.avaliacoes;
drop trigger if exists contato_imovel_titulo on public.properties;
drop trigger if exists contato_imovel_descricao on public.properties;
drop trigger if exists contato_perfil_nome on public.profiles;
drop function if exists public.bloqueia_contato_texto();
drop function if exists public.contem_contato(text, boolean);

commit;
