-- 0256 — massa de teste para o QA ao vivo do E235 (link do nº do avaliador): um laudo aprovado e um pedido designado ao
-- avaliador de teste UDI-002, no anúncio PAUSADO [TESTE QA NÍVEL] Conforto do proprietario1 (is_teste). Só contas e
-- anúncio de teste; ids fixos a0256000-…; não liga a VISTORIA_ATIVA (o bloco abre só para o dono de teste, só leitura).
-- Idempotente. Desfazer: supabase/producao/rollback/0256_rollback.sql.

do $$
declare
  -- Conta de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  v_dono uuid;
  v_avaliador uuid;
  -- O anúncio de teste escolhido: [TESTE QA NÍVEL] Conforto, PAUSADO (fora da busca pública; o "· vistoriado" não aparece).
  c_imovel constant uuid := '57bcac8e-e45a-4fa6-a430-1579f9035a94';
  -- Ids fixos de tudo o que este script cria: o desfazer apaga por eles.
  c_pedido_laudo constant uuid := 'a0256000-0000-4000-8000-0000000000a1';
  c_laudo constant uuid := 'a0256000-0000-4000-8000-0000000000b1';
  c_pedido_designado constant uuid := 'a0256000-0000-4000-8000-0000000000a2';
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0256: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and title like '[TESTE QA%') then
    raise notice '0256: anúncio [TESTE QA NÍVEL] Conforto ausente ou de outro dono; nada a fazer';
    return;
  end if;
  -- O avaliador credenciado de teste UDI-002 (avaliador1@, "Avaliador Teste QA"), ativo ou em teste.
  select id into v_avaliador from public.avaliadores_credenciamento where numero_credenciado = 'UDI-002' and status in ('ativo', 'em_teste');
  if v_avaliador is null then
    raise notice '0256: avaliador UDI-002 ausente ou não credenciado; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.vistoria_pedidos where id in (c_pedido_laudo, c_pedido_designado)) then
    raise notice '0256: massa do laudo já existe; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.vistoria_pedidos where property_id = c_imovel) then
    raise notice '0256: o anúncio já tem pedido de avaliação; nada a fazer (sem sobreposição)';
    return;
  end if;

  -- 1. Avaliação passada, com laudo aprovado (o laudo mostra "Avaliado em … por avaliador credenciado nº UDI-002").
  --    Emitido há 9 dias: fora dos 7 dias de contestação, sem ação pendente. teste = true: fora das contagens públicas.
  insert into public.vistoria_pedidos (id, property_id, owner_id, cidade, porte, valor_tabela, status, avaliador_id, designado_em, teste, criado_em)
  values (c_pedido_laudo, c_imovel, v_dono, 'Uberlândia', 'q1_2', 350, 'laudo_emitido', v_avaliador, now() - interval '12 days', true, now() - interval '12 days');
  insert into public.vistoria_laudos (id, pedido_id, pedido_versao_id, property_id, owner_id, avaliador_id, numero, resultado, nivel_sustentado, emitido_em, vistoriado_em, teste)
  values (c_laudo, c_pedido_laudo, c_pedido_laudo, c_imovel, v_dono, v_avaliador, 'VIS-QA-0256', 'aprovado', 'conforto', now() - interval '9 days', now() - interval '9 days', true);

  -- 2. Pedido atual, designado ao mesmo avaliador (o bloco mostra "Avaliador designado pela Viva: nº UDI-002").
  --    SEM linha em vistoria_designacoes: a rotina de hora em hora só passa adiante designação sem resposta, então este
  --    pedido fica parado (nada de e-mail, rodízio ou lembrete D-1, que é só de "agendado").
  insert into public.vistoria_pedidos (id, property_id, owner_id, cidade, porte, valor_tabela, status, avaliador_id, designado_em, teste, criado_em)
  values (c_pedido_designado, c_imovel, v_dono, 'Uberlândia', 'q1_2', 350, 'designado', v_avaliador, now(), true, now());
end
$$;
