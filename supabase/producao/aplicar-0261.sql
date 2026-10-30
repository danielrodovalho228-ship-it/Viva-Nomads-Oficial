-- Viva Nomads — aplicar 0261 (QA: massa da prova ao vivo do E213, limpeza × renovação). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0261_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_parceiro_user uuid;
  v_morador_a uuid;
  v_morador_b uuid;
  c_imovel_a constant uuid := 'b30ddd02-48d9-4d37-9520-a92c894af6bb'; -- [TESTE QA] Carteira 1
  c_imovel_b constant uuid := '57bcac8e-e45a-4fa6-a430-1579f9035a94'; -- [TESTE QA NÍVEL] Conforto
  c_solicitacao constant uuid := 'a0261000-0000-4000-8000-000000000010';
  c_parceiro constant uuid := 'a0261000-0000-4000-8000-000000000011';
  c_servico constant uuid := 'a0261000-0000-4000-8000-000000000012';
  c_vinculo_a constant uuid := 'a0261000-0000-4000-8000-000000000021';
  c_contrato_a constant uuid := 'a0261a00-0000-4000-8000-000000000022';
  c_bloco_a constant uuid := 'a0261000-0000-4000-8000-000000000023';
  c_pedido_a constant uuid := 'a0261000-0000-4000-8000-000000000024';
  c_vinculo_b constant uuid := 'a0261000-0000-4000-8000-000000000031';
  c_contrato_b constant uuid := 'a0261b00-0000-4000-8000-000000000032';
  c_bloco_b constant uuid := 'a0261000-0000-4000-8000-000000000033';
  c_pedido_b constant uuid := 'a0261000-0000-4000-8000-000000000034';
  v_saida date := current_date + 4;
  v_inicio date := current_date - 26;
  -- Janela da limpeza (a mesma regra do código): saída às 11:00 de Brasília + 2 h até + 48 h.
  v_janela_inicio timestamptz := ((current_date + 4) + time '13:00') at time zone 'America/Sao_Paulo';
  v_janela_fim timestamptz := ((current_date + 4) + time '11:00') at time zone 'America/Sao_Paulo' + interval '48 hours';
  v_horarios timestamptz[];
  v_pedidos jsonb;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_parceiro_user from public.profiles where lower(email) = 'cadastro-teste-2310@vivanomads.com.br' and is_teste;
  select id into v_morador_a from public.profiles where lower(email) = 'cadastro2@vivanomads.com.br' and is_teste;
  select id into v_morador_b from public.profiles where lower(email) = 'cadastro3@vivanomads.com.br' and is_teste;
  if v_dono is null or v_parceiro_user is null or v_morador_a is null or v_morador_b is null then
    raise notice '0261: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where id in (c_contrato_a, c_contrato_b)) or exists (select 1 from public.parceiros where id = c_parceiro) then
    raise notice '0261: a massa da prova já existe; nada a fazer';
    return;
  end if;
  if (select count(*) from public.properties where id in (c_imovel_a, c_imovel_b) and owner_id = v_dono and title like '[TESTE QA%') <> 2 then
    raise notice '0261: anúncios [TESTE QA] Carteira 1 / Conforto ausentes ou de outro dono; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where property_id in (c_imovel_a, c_imovel_b) and status = 'ativo') then
    raise notice '0261: um dos anúncios já tem estadia ativa; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.imovel_parceiros where property_id in (c_imovel_a, c_imovel_b) and categoria = 'limpeza' and status in ('pendente', 'ativo')) then
    raise notice '0261: um dos anúncios já tem parceiro de limpeza; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.parceiros where user_id = v_parceiro_user) then
    raise notice '0261: a conta de teste do parceiro já é parceira; nada a fazer';
    return;
  end if;

  -- 1) Parceiro de limpeza de teste, aprovado e publicado, com um serviço de limpeza.
  insert into public.parceiro_solicitacoes (id, user_id, email, nome, tipo_pessoa, documento, categorias, cidades, descricao, status, decidido_em, origem)
  values (c_solicitacao, v_parceiro_user, 'cadastro-teste-2310@vivanomads.com.br', '[TESTE QA] Limpeza E213', 'pf', '00000000000',
          array['limpeza'], array['Uberlândia'], 'Conta de teste da prova ao vivo do E213 (limpeza × renovação).', 'ativada', now(), 'suporte');
  insert into public.parceiros (id, user_id, solicitacao_id, tipo_pessoa, documento, nome_publico, slug, categorias, cidades, descricao_curta, status, publicado_em)
  values (c_parceiro, v_parceiro_user, c_solicitacao, 'pf', '00000000000', '[TESTE QA] Limpeza E213', 'teste-qa-limpeza-e213',
          array['limpeza'], array['Uberlândia'], 'Parceiro de teste da prova ao vivo do E213.', 'publicado', now());
  insert into public.parceiro_servicos (id, parceiro_id, categoria, titulo, preco_base, unidade, ativo)
  values (c_servico, c_parceiro, 'limpeza', 'Limpeza da saída (teste E213)', 250, 'por serviço', true);

  -- 2) Vínculo de limpeza ATIVO e AUTOMÁTICO nos dois anúncios.
  insert into public.imovel_parceiros (id, property_id, categoria, parceiro_id, servico_id, modo, status, respondido_em)
  values (c_vinculo_a, c_imovel_a, 'limpeza', c_parceiro, c_servico, 'automatico', 'ativo', now()),
         (c_vinculo_b, c_imovel_b, 'limpeza', c_parceiro, c_servico, 'automatico', 'ativo', now());

  -- 3) As duas estadias: 1 bloco de 1 mês que termina em D+4, ativas e assinadas pelas duas partes. Os pedidos de
  -- moradia das moradoras são guardados e devolvidos (o gatilho pedido_atendido_no_contrato não muda nada fora daqui).
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id in (v_morador_a, v_morador_b);
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato_a, c_imovel_a, v_morador_a, 'ativo', 'temporada', daterange(v_inicio, v_saida + 1, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 384, (v_saida - v_inicio + 1), 1, (v_inicio - 1)::timestamptz + interval '12 hours', (v_inicio - 1)::timestamptz + interval '12 hours'),
         (c_contrato_b, c_imovel_b, v_morador_b, 'ativo', 'temporada', daterange(v_inicio, v_saida + 1, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 384, (v_saida - v_inicio + 1), 1, (v_inicio - 1)::timestamptz + interval '12 hours', (v_inicio - 1)::timestamptz + interval '12 hours');
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco_a, c_contrato_a, 1, v_inicio, v_saida, 1, 3200, 3200, 'avista', 'pendente', 'ativo'),
         (c_bloco_b, c_contrato_b, 1, v_inicio, v_saida, 1, 3200, 3200, 'avista', 'pendente', 'ativo');
  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  -- 4) Os pedidos automáticos da saída, com a chave do cron (imóvel:limpeza:contrato:saida): o D-5 não cria outro.
  v_horarios := array[v_janela_inicio, v_janela_inicio + interval '2 hours', v_janela_inicio + interval '4 hours'];
  insert into public.parceiro_pedidos (id, codigo, parceiro_id, cliente_id, property_id, contrato_id, vinculo_id, servico_id, categoria,
                                       origem, gatilho, chave_automacao, status, aguardando_dono, descricao, horarios_propostos,
                                       janela_inicio, janela_fim, enviado_em)
  values (c_pedido_a, 'VN-SV-E213A261', c_parceiro, v_dono, c_imovel_a, c_contrato_a, c_vinculo_a, c_servico, 'limpeza',
          'automatico', 'saida_limpeza', c_imovel_a || ':limpeza:' || c_contrato_a || ':saida', 'solicitado', false,
          'Limpeza depois da saída do morador (massa de teste do E213, caminho a: sem aceite).', v_horarios,
          v_janela_inicio, v_janela_fim, now());
  insert into public.parceiro_pedidos (id, codigo, parceiro_id, cliente_id, property_id, contrato_id, vinculo_id, servico_id, categoria,
                                       origem, gatilho, chave_automacao, status, aguardando_dono, descricao, horarios_propostos,
                                       janela_inicio, janela_fim, enviado_em, horario_confirmado,
                                       valor_combinado, taxa_percent, valor_taxa, valor_parceiro)
  values (c_pedido_b, 'VN-SV-E213B261', c_parceiro, v_dono, c_imovel_b, c_contrato_b, c_vinculo_b, c_servico, 'limpeza',
          'automatico', 'saida_limpeza', c_imovel_b || ':limpeza:' || c_contrato_b || ':saida', 'agendado', false,
          'Limpeza depois da saída do morador (massa de teste do E213, caminho b: aceito e agendado).', v_horarios,
          v_janela_inicio, v_janela_fim, now(), v_janela_inicio,
          250, 0.100, 25, 225);
  insert into public.parceiro_pedido_eventos (pedido_id, tipo, dados)
  values (c_pedido_a, 'solicitado', jsonb_build_object('automatico', true, 'gatilho', 'saida_limpeza', 'massa', '0261')),
         (c_pedido_b, 'solicitado', jsonb_build_object('automatico', true, 'gatilho', 'saida_limpeza', 'massa', '0261'));
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000261', '0261_qa_limpeza_renovacao_e213', array['-- conteúdo em supabase/migrations/0261_qa_limpeza_renovacao_e213.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000261');
commit;
