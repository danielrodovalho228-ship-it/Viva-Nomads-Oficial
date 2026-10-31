-- 0270 — E274 (decisão do Muse, 31/10 16:3x): a Pista B publica o anúncio de teste da reprova ao vivo pela migração.
-- Publica "[TESTE QA] Proativo E274 C" (a0269000-…0001, massa 0269, do proprietario1) e põe na fila dos proativos o
-- cartão "pedido_imovel_novo" da inquilino2 para o pedido 9ae996c8… — exatamente a linha que a publicação pela tela
-- grava (avisarPedidosDoImovel → enfileirarProativo). O e-mail sai no próximo despacho diário da fila
-- (/api/cron/resumo-pedidos, 11:00 UTC = 08:00 em Brasília), com o modelo corrigido no #1682, dentro do teto (1 por dia,
-- 3 em 7 dias) e fora do silêncio das 22h às 7h. Só contas de teste; não toca o contrato-semente, AUTOMACOES_ATIVO,
-- o pedido nem nenhum dado real. Idempotente (só publica rascunho; a chave da fila é única).
-- Desfazer: supabase/producao/rollback/0270_rollback.sql.

do $$
declare
  v_dono uuid;
  v_inq uuid;
  v_pedido uuid;
  c_imovel constant uuid := 'a0269000-0000-4000-8000-000000000001';
begin
  -- Só contas de teste (e-mail E is_teste): em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_inq from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_dono is null or v_inq is null then
    raise notice '0270: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  -- O anúncio da massa 0269, do proprietario1 e com título de teste.
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and title = '[TESTE QA] Proativo E274 C') then
    raise notice '0270: o anúncio da 0269 não existe para o proprietario1; nada a fazer';
    return;
  end if;
  -- O pedido ATIVO da inquilino2 que casa com ele (9ae996c8…: Uberlândia, até R$ 4.000/mês).
  select id into v_pedido from public.pedidos_moradia
   where id = '9ae996c8-058b-4a84-8c88-1564112bcc2d' and inquilino_id = v_inq and status = 'ativo';
  if v_pedido is null then
    raise notice '0270: o pedido 9ae996c8 da inquilino2 não está ativo; nada a fazer';
    return;
  end if;

  -- Publica como o Publicar faz (status active e draft_data zerado), levando a descrição do rascunho para a coluna.
  update public.properties
     set description = coalesce(description, draft_data->>'description'),
         status = 'active',
         draft_data = null
   where id = c_imovel and status = 'draft';

  -- O mesmo que avisarPedidosDoImovel faz para a moradora: uma linha na fila dos proativos (chave de chaveProativo),
  -- despachada pelo cron diário /api/cron/resumo-pedidos com o cartão do #1682 (foto de capa, teto e silêncio).
  insert into public.emails_proativos (usuario_id, evento, ref_id, chave, extra)
  values (v_inq, 'pedido_imovel_novo', c_imovel, 'proativo:pedido_imovel_novo:' || v_inq::text || ':' || c_imovel::text,
          jsonb_build_object('pedido_id', v_pedido))
  on conflict (chave) do nothing;
end
$$;
