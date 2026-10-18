-- Ordem 65e999b2 (complemento): o DONO aprova o rascunho montado pela equipe ou pede ajustes.
-- Novos status 'aprovado_dono' e 'ajustes_pedidos'. O dono só decide sobre pedido seu que está
-- 'enviado_dono'; só pode vincular imóvel dele. Publicar continua exigindo documento aprovado.
alter table public.pedidos_ajuda_publicacao drop constraint if exists pedidos_ajuda_publicacao_status_check;
alter table public.pedidos_ajuda_publicacao add constraint pedidos_ajuda_publicacao_status_check
  check (status in ('recebido', 'em_montagem', 'enviado_dono', 'aprovado_dono', 'ajustes_pedidos', 'cancelado'));

drop policy if exists ajuda_publicacao_dono_decide on public.pedidos_ajuda_publicacao;
create policy ajuda_publicacao_dono_decide on public.pedidos_ajuda_publicacao
  for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'enviado_dono')
  with check (
    owner_id = (select auth.uid())
    and status in ('aprovado_dono', 'ajustes_pedidos')
    and (property_id is null or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  );
