-- Viva Nomads — aplicar 0337 (QA E759/E689: estadia-semente do D-7 de entrada; só contas de teste).
-- Idempotente. Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0337_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_alvo date;
  v_pedidos jsonb;
  c_imovel constant uuid := 'a0337d00-0000-4000-8000-000000000001';
  c_contrato constant uuid := 'a0337d00-0000-4000-8000-000000000011';
  c_bloco constant uuid := 'a0337d00-0000-4000-8000-000000000021';
begin
  -- Só contas de teste (e-mail E is_teste): em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'cadastro1@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0337: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.properties where id = c_imovel) then
    raise notice '0337: a massa já existe; nada a fazer';
    return;
  end if;
  v_alvo := v_agora::date + case when v_agora::time >= time '09:30' then 1 else 0 end;

  -- 1) Anúncio de teste NOVO e pausado (fora da busca), com o horário do imóvel preenchido.
  insert into public.properties (id, owner_id, status, title, description, property_type, city, state, address, bedrooms, bathrooms,
                                 max_guests, monthly_price, min_period_days, max_period_days, furnished, checkin_after, checkout_before)
  values (c_imovel, v_dono, 'paused', '[TESTE QA] Estadia-semente E759 D-7', 'Anúncio de teste da estadia com a entrada daqui a 7 dias (E759 D-7 de entrada).', 'apartamento',
          'Uberlândia', 'MG', 'Santa Mônica', 2, 1, 4, 3200, 30, 180, true, '14:00', '11:00');

  -- 2) Contrato ativo, assinado pelas duas partes há 5 dias; entrada em ALVO+7, 30 dias (o último dia do bloco é a
  -- saída, inclusivo, como o app lê). Os pedidos de moradia da moradora são guardados e devolvidos (como na 0327).
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato, c_imovel, v_morador, 'ativo', 'media_estadia', daterange(v_alvo + 7, v_alvo + 37, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 384, 30, 1, (v_alvo - 5)::timestamptz, (v_alvo - 5)::timestamptz);
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco, c_contrato, 1, v_alvo + 7, v_alvo + 36, 1, 3200, 3200, 'avista', 'pendente', 'agendado');
  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  -- 3) O 1º pagamento do aluguel, marcado pelo dono e confirmado pela moradora (o D-7 só sai com ele).
  insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, forma, data_pagamento, marcado_por, confirmado_pelo_inquilino, confirmado_em, observacao)
  values (c_bloco, c_contrato, 'aluguel', 3200, 'pix', v_alvo - 1, v_dono, true, now(), 'Massa de teste E759');
end
$$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261111000337', '0337_qa_estadia_semente_d7_e759'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261111000337');

commit;
