-- Viva Nomads — aplicar 0260 (QA: contrato de teste para a prova ao vivo do lembrete de início de bloco). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0260_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  c_imovel constant uuid := '297b71ec-26e6-4bd5-b6e9-5d79e8ea947c';
  c_contrato constant uuid := 'a0260000-0000-4000-8000-000000000001';
  c_bloco constant uuid := 'a0260000-0000-4000-8000-000000000002';
  v_inicio date := current_date - 29;
  v_fim date := current_date + 2;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'cadastro1@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0260: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where id = c_contrato) then
    raise notice '0260: o contrato da prova já existe; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and title like '[TESTE QA%') then
    raise notice '0260: anúncio [TESTE QA] Carteira 2 ausente ou de outro dono; nada a fazer';
    return;
  end if;
  -- Sem parceiro fixo no anúncio (o pedido automático de limpeza da saída dispararia sozinho) e sem estadia ativa.
  if exists (select 1 from public.imovel_parceiros where property_id = c_imovel) then
    raise notice '0260: o anúncio tem parceiro fixo; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where property_id = c_imovel and status = 'ativo') then
    raise notice '0260: o anúncio já tem estadia ativa; nada a fazer';
    return;
  end if;

  insert into public.contratos (id, property_id, tenant_id, status, faixa, periodo, garantia, owner_plan, multa_status,
                                qtd_ocupantes, aluguel_mensal, comissao_percent, comissao_valor, prazo_total_dias,
                                tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato, c_imovel, v_morador, 'ativo', 'temporada', daterange(v_inicio, v_fim + 1, '[)'), 'caucao', 'free', 'nenhuma',
          1, 3200, 0.12, 384, (v_fim - v_inicio + 1), 1, (v_inicio - 1)::timestamptz + interval '12 hours', (v_inicio - 1)::timestamptz + interval '12 hours');

  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_forma, caucao_status, status)
  values (c_bloco, c_contrato, 1, v_inicio, v_fim, 1, 3200, 3200, 'avista', 'pendente', 'ativo');
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000260', '0260_qa_contrato_lembrete_bloco', array['-- conteúdo em supabase/migrations/0260_qa_contrato_lembrete_bloco.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000260');
commit;
