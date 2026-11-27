-- Viva Nomads — aplicar 0296 (QA, E486: estadia ATIVA de teste da inquilino2@ para a prova da manutenção do E485). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Só contas is_teste. Rollback: supabase/producao/rollback/0296_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  c_imovel constant uuid := '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff'; -- TESTE QA - Casa mobiliada 2 quartos no Centro
  c_contrato constant uuid := 'e4860000-0000-4000-8000-0000000000c1';
  c_bloco constant uuid := 'e4860000-0000-4000-8000-0000000000b1';
  c_pagamento constant uuid := 'e4860000-0000-4000-8000-0000000000a1';
  v_inicio date := current_date - 7;
  v_fim date := current_date + 52;
  v_pedidos jsonb;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario2@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0296: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where id = c_contrato) then
    raise notice '0296: a estadia de teste já existe; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and status = 'active' and title like 'TESTE QA%') then
    raise notice '0296: anúncio de teste 4a693a63 ausente, inativo ou de outro dono; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where property_id = c_imovel and status in ('ativo', 'encerrado_em_acerto')) then
    raise notice '0296: o anúncio de teste já tem estadia ativa; nada a fazer (sem sobreposição)';
    return;
  end if;
  if exists (select 1 from public.contratos where tenant_id = v_morador and status in ('ativo', 'encerrado_em_acerto')) then
    raise notice '0296: a moradora de teste já tem estadia ativa; nada a fazer';
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;

  -- 1) O contrato: ativo e assinado pelas duas partes na véspera do início.
  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato, c_imovel, v_morador, 'ativo', 'temporada', daterange(v_inicio, v_fim + 1, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 768, (v_fim - v_inicio + 1), 2,
          (v_inicio - 1)::timestamptz + interval '12 hours', (v_inicio - 1)::timestamptz + interval '12 hours');

  -- 2) O bloco 1 (2 meses), ativo.
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco, c_contrato, 1, v_inicio, v_fim, 2, 6400, 3200, 'avista', 'pendente', 'ativo');

  -- 3) O 1º aluguel, marcado pelo dono e confirmado pela moradora → "Em vigência".
  insert into public.pagamentos_bloco (id, bloco_id, contrato_id, tipo, valor, forma, data_pagamento, marcado_por,
                                       confirmado_pelo_inquilino, confirmado_em, observacao)
  values (c_pagamento, c_bloco, c_contrato, 'aluguel', 3200, 'pix', v_inicio, v_dono, true,
          v_inicio::timestamptz + interval '15 hours', 'Massa de teste do E486 (prova da manutenção do E485).');

  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  raise notice '0296: estadia de teste criada — VN-CT-E4860000, inquilino2@ × 4a693a63, em vigência';
end
$$;

-- Conferência (somente leitura):
--   select c.status, c.periodo, b.inicio, b.fim, p.confirmado_pelo_inquilino from public.contratos c
--     join public.contrato_blocos b on b.contrato_id = c.id join public.pagamentos_bloco p on p.contrato_id = c.id
--    where c.id = 'e4860000-0000-4000-8000-0000000000c1';   -- ativo, D-7 → D+52, true

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000296', '0296_qa_estadia_ativa_inquilino2_e486', array['-- conteúdo em supabase/migrations/0296_qa_estadia_ativa_inquilino2_e486.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000296');
commit;
