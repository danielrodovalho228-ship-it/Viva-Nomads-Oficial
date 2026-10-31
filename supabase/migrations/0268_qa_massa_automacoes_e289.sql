-- 0268 — massa da prova ao vivo do E289, grupo 1 (os 5 e-mails do cron de automações com os fatos do caso; Muse, 31/10).
-- Tudo do proprietario1 (is_teste) com a moradora cadastro1 (Fernanda, is_teste), em 3 anúncios de teste NOVOS e
-- pausados (fora da busca), com o horário do imóvel preenchido (saída até 11:00, entrada a partir das 14:00):
--   "[TESTE QA] Automações E289 S" → contrato com saída em ALVO+3            → saida_lembrete (dono e moradora)
--   "[TESTE QA] Automações E289 A" → contrato que terminou em ALVO-1          → avaliacao_pedido (dono e moradora)
--                                  + contrato com entrada em ALVO+10, sem instruções de chegada
--                                                                             → estadia_instrucoes_pendentes (dono)
--   "[TESTE QA] Automações E289 R" → contrato com o bloco terminando em ALVO+15 → renovacao_aviso (dono e moradora)
--                                  + proposta da moradora que vence no dia ALVO às 22:00 (horário de Brasília)
--                                                                             → proposta_vencendo (dono)
-- ALVO é o dia da PRÓXIMA rodada do cron (vercel.json: 13:00 UTC = 10:00 em Brasília): o próprio dia da aplicação se
-- ela acontecer antes das 09:30 de Brasília, senão o dia seguinte. As regras do cron são de dia exato (D+3, D-1, D+15,
-- D+10, vence em 24 h): fora do dia ALVO, os avisos não saem (a massa não se repete sozinha).
-- O cron envia de verdade só com AUTOMACOES_ATIVO=1 (esta migração não mexe nisso); as contas são de teste, então os
-- e-mails caem na caixa de teste (emails_teste). Ids fixos a0268…; não toca a seed do D-5, a Ana, nem outras massas.
-- Idempotente (se a massa já existe, nada acontece). Desfazer: supabase/producao/rollback/0268_rollback.sql.
do $$
declare
  v_dono uuid;
  v_morador uuid;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_alvo date;
  v_pedidos jsonb;
  v_numero text;
  c_imovel_s constant uuid := 'a0268a00-0000-4000-8000-000000000001';
  c_imovel_a constant uuid := 'a0268b00-0000-4000-8000-000000000001';
  c_imovel_r constant uuid := 'a0268c00-0000-4000-8000-000000000001';
  c_contrato_s constant uuid := 'a0268a00-0000-4000-8000-000000000011';
  c_contrato_a constant uuid := 'a0268b00-0000-4000-8000-000000000011';
  c_contrato_i constant uuid := 'a0268b00-0000-4000-8000-000000000021';
  c_contrato_r constant uuid := 'a0268c00-0000-4000-8000-000000000011';
  c_lead constant uuid := 'a0268c00-0000-4000-8000-000000000031';
  c_proposta constant uuid := 'a0268c00-0000-4000-8000-000000000032';
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'cadastro1@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0268: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.properties where id in (c_imovel_s, c_imovel_a, c_imovel_r)) then
    raise notice '0268: a massa já existe; nada a fazer';
    return;
  end if;
  v_alvo := v_agora::date + case when v_agora::time >= time '09:30' then 1 else 0 end;

  -- 1) Os 3 anúncios de teste (pausados: fora da busca), com bairro, cidade e o horário do imóvel.
  insert into public.properties (id, owner_id, status, title, description, property_type, city, state, address, bedrooms, bathrooms,
                                 max_guests, monthly_price, min_period_days, max_period_days, furnished, checkin_after, checkout_before)
  values (c_imovel_s, v_dono, 'paused', '[TESTE QA] Automações E289 S', 'Anúncio de teste da prova do E289 (saída).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00'),
         (c_imovel_a, v_dono, 'paused', '[TESTE QA] Automações E289 A', 'Anúncio de teste da prova do E289 (avaliação e instruções).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00'),
         (c_imovel_r, v_dono, 'paused', '[TESTE QA] Automações E289 R', 'Anúncio de teste da prova do E289 (renovação e proposta).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00');

  -- 2) Os contratos de teste, assinados pelas duas partes. Os pedidos de moradia da moradora são guardados e devolvidos
  -- (o gatilho pedido_atendido_no_contrato não muda nada fora daqui), como na 0261.
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values
    -- S: saída em ALVO+3.
    (c_contrato_s, c_imovel_s, v_morador, 'ativo', 'media_estadia', daterange(v_alvo - 27, v_alvo + 4, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 31, 1, (v_alvo - 30)::timestamptz, (v_alvo - 30)::timestamptz),
    -- A: terminou em ALVO-1 (a avaliação sai no dia seguinte à saída).
    (c_contrato_a, c_imovel_a, v_morador, 'ativo', 'media_estadia', daterange(v_alvo - 31, v_alvo, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 31, 1, (v_alvo - 34)::timestamptz, (v_alvo - 34)::timestamptz),
    -- I: entrada em ALVO+10, no mesmo anúncio (sem instruções de chegada: o dono é lembrado no D-10).
    (c_contrato_i, c_imovel_a, v_morador, 'ativo', 'media_estadia', daterange(v_alvo + 10, v_alvo + 41, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 31, 1, (v_alvo - 2)::timestamptz, (v_alvo - 2)::timestamptz),
    -- R: o bloco termina em ALVO+15.
    (c_contrato_r, c_imovel_r, v_morador, 'ativo', 'media_estadia', daterange(v_alvo - 14, v_alvo + 16, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 30, 1, (v_alvo - 17)::timestamptz, (v_alvo - 17)::timestamptz);
  insert into public.contrato_blocos (contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_contrato_s, 1, v_alvo - 27, v_alvo + 3, 1, 3200, 3200, 'avista', 'pendente', 'ativo'),
         (c_contrato_a, 1, v_alvo - 31, v_alvo - 1, 1, 3200, 3200, 'avista', 'pendente', 'encerrado'),
         (c_contrato_i, 1, v_alvo + 10, v_alvo + 40, 1, 3200, 3200, 'avista', 'pendente', 'agendado'),
         (c_contrato_r, 1, v_alvo - 14, v_alvo + 15, 1, 3200, 3200, 'avista', 'pendente', 'ativo');
  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  -- 3) A proposta da moradora (última versão dela: a vez é do dono), vencendo no dia ALVO às 22:00 de Brasília, 12 h
  -- depois da rodada do cron. Número pela mesma numeração das propostas do app (next_document_number, ORC-AAAA-NNNN).
  insert into public.leads (id, owner_id, tenant_id, property_id, status)
  values (c_lead, v_dono, v_morador, c_imovel_r, 'accepted');
  v_numero := public.next_document_number('orcamento'::public.doc_type, extract(year from v_agora)::int);
  insert into public.propostas (id, numero, lead_id, property_id, owner_id, tenant_id, status, versao_atual, validade_dias, valida_ate)
  values (c_proposta, v_numero, c_lead, c_imovel_r, v_dono, v_morador, 'enviada', 1, 3, (v_alvo + time '22:00') at time zone 'America/Sao_Paulo');
  insert into public.proposta_versoes (proposta_id, versao, autor, valor_base, valor_mensal, meses, data_entrada, total_mensal, total_contrato)
  values (c_proposta, 1, 'tenant', 3200, 3200, 2, v_alvo + 20, 3200, 6400);
end
$$;
