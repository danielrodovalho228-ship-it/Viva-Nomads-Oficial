-- Viva Nomads — aplicar 0327 (QA: estadias-semente do E689 com a jornada de e-mails, a emergência da chegada e os pedidos
-- de limpeza na janela). Idempotente. Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0327_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_alvo date;
  v_pedidos jsonb;
  c_parceiro constant uuid := 'a0261000-0000-4000-8000-000000000011'; -- parceiro de limpeza de teste do E213 (0261)
  c_servico constant uuid := 'a0261000-0000-4000-8000-000000000012';
  c_imovel_c constant uuid := 'a0327a00-0000-4000-8000-000000000001';
  c_imovel_m constant uuid := 'a0327b00-0000-4000-8000-000000000001';
  c_imovel_s constant uuid := 'a0327c00-0000-4000-8000-000000000001';
  c_contrato_c constant uuid := 'a0327a00-0000-4000-8000-000000000011';
  c_contrato_m constant uuid := 'a0327b00-0000-4000-8000-000000000011';
  c_contrato_s constant uuid := 'a0327c00-0000-4000-8000-000000000011';
  c_bloco_c constant uuid := 'a0327a00-0000-4000-8000-000000000021';
  c_bloco_m constant uuid := 'a0327b00-0000-4000-8000-000000000021';
  c_bloco_s constant uuid := 'a0327c00-0000-4000-8000-000000000021';
begin
  -- Só contas de teste (e-mail E is_teste): em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'cadastro1@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0327: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.properties where id in (c_imovel_c, c_imovel_m, c_imovel_s)) then
    raise notice '0327: a massa já existe; nada a fazer';
    return;
  end if;
  -- Os pedidos de limpeza usam o parceiro de teste do E213 (0261); sem ele, a massa não nasce pela metade.
  if not exists (select 1 from public.parceiros where id = c_parceiro) or not exists (select 1 from public.parceiro_servicos where id = c_servico) then
    raise notice '0327: parceiro de limpeza de teste (0261) ausente; nada a fazer';
    return;
  end if;
  -- ALVO é o dia da PRÓXIMA rodada do cron (13:00 UTC = 10:00 em Brasília): hoje se a aplicação for antes das 09:30 de
  -- Brasília, senão amanhã. A chegada, o meio e a semana da saída caem EXATAMENTE nesse dia (regras de dia exato).
  v_alvo := v_agora::date + case when v_agora::time >= time '09:30' then 1 else 0 end;

  -- 1) Os 3 anúncios de teste NOVOS e pausados (fora da busca), com o horário do imóvel preenchido.
  insert into public.properties (id, owner_id, status, title, description, property_type, city, state, address, bedrooms, bathrooms,
                                 max_guests, monthly_price, min_period_days, max_period_days, furnished, checkin_after, checkout_before)
  values (c_imovel_c, v_dono, 'paused', '[TESTE QA] Estadia-semente E689 chegada', 'Anúncio de teste da estadia com entrada no dia (E663 chegada, E664 emergência).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00'),
         (c_imovel_m, v_dono, 'paused', '[TESTE QA] Estadia-semente E689 meio', 'Anúncio de teste da estadia no meio do período (E663 meio da estadia).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00'),
         (c_imovel_s, v_dono, 'paused', '[TESTE QA] Estadia-semente E689 saída', 'Anúncio de teste da estadia na semana da saída (E663 semana da saída).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00');

  -- 2) Os contratos de teste ativos e assinados pelas duas partes (há mais de 2 dias: a confirmação não conta).
  -- Os pedidos de moradia da moradora são guardados e devolvidos (como na 0261/0268).
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values
    -- Chegada: a entrada é o dia ALVO (30 dias): E663 chegada + botão do E664.
    (c_contrato_c, c_imovel_c, v_morador, 'ativo', 'media_estadia', daterange(v_alvo, v_alvo + 30, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 30, 1, (v_alvo - 5)::timestamptz, (v_alvo - 5)::timestamptz),
    -- Meio: 60 dias, o ponto médio (entrada + 30) é o dia ALVO: E663 meio da estadia.
    (c_contrato_m, c_imovel_m, v_morador, 'ativo', 'media_estadia', daterange(v_alvo - 30, v_alvo + 30, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 60, 2, (v_alvo - 35)::timestamptz, (v_alvo - 35)::timestamptz),
    -- Semana da saída: a saída é ALVO+7 (30 dias): E663 semana da saída.
    (c_contrato_s, c_imovel_s, v_morador, 'ativo', 'media_estadia', daterange(v_alvo - 23, v_alvo + 7, '[)'), 'caucao', 'free', 'nenhuma',
     1, 3200, 0.12, 384, 30, 1, (v_alvo - 28)::timestamptz, (v_alvo - 28)::timestamptz);
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco_c, c_contrato_c, 1, v_alvo, v_alvo + 29, 1, 3200, 3200, 'avista', 'pendente', 'agendado'),
         (c_bloco_m, c_contrato_m, 1, v_alvo - 30, v_alvo + 29, 2, 6400, 3200, 'avista', 'pendente', 'ativo'),
         (c_bloco_s, c_contrato_s, 1, v_alvo - 23, v_alvo + 6, 1, 3200, 3200, 'avista', 'pendente', 'ativo');
  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  -- 3) O 1º pagamento do aluguel, marcado pelo dono e confirmado pela moradora: a chegada e a semana da saída só saem
  -- com ele (a mesma condição do D-7 das instruções).
  insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, forma, data_pagamento, marcado_por, confirmado_pelo_inquilino, confirmado_em, observacao)
  values (c_bloco_c, c_contrato_c, 'aluguel', 3200, 'pix', v_alvo - 1, v_dono, true, now(), 'Massa de teste E689'),
         (c_bloco_m, c_contrato_m, 'aluguel', 6400, 'pix', v_alvo - 31, v_dono, true, now(), 'Massa de teste E689'),
         (c_bloco_s, c_contrato_s, 'aluguel', 3200, 'pix', v_alvo - 24, v_dono, true, now(), 'Massa de teste E689');

  -- 4) Pedidos de limpeza do parceiro de teste, amarrados ao contrato: a de pré-chegada (antes da entrada) e a da saída.
  -- Pedidos normais (origem manual, sem chave de automação): o cron do D-5 não os conhece nem cria outro.
  insert into public.parceiro_pedidos (id, codigo, parceiro_id, cliente_id, servico_id, property_id, contrato_id, categoria, descricao, status, data_sugerida)
  values ('a0327a00-0000-4000-8000-000000000031', 'VN-SV-E689A327', c_parceiro, v_dono, c_servico, c_imovel_c, c_contrato_c, 'limpeza',
          'Limpeza de pré-chegada, antes da entrada do morador (massa de teste do E689).', 'solicitado', v_alvo - 1),
         ('a0327c00-0000-4000-8000-000000000031', 'VN-SV-E689C327', c_parceiro, v_dono, c_servico, c_imovel_s, c_contrato_s, 'limpeza',
          'Limpeza depois da saída do morador (massa de teste do E689).', 'solicitado', v_alvo + 8);
  insert into public.parceiro_pedido_eventos (pedido_id, tipo, dados)
  values ('a0327a00-0000-4000-8000-000000000031', 'solicitado', jsonb_build_object('massa', '0327', 'momento', 'pre_chegada')),
         ('a0327c00-0000-4000-8000-000000000031', 'solicitado', jsonb_build_object('massa', '0327', 'momento', 'saida'));
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000327', '0327_qa_estadia_semente_e689', array['-- conteúdo em supabase/migrations/0327_qa_estadia_semente_e689.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000327');
commit;
