-- Viva Nomads — aplicar 0247 (dados de teste da prova do disparo D-5, Onda 2 / Prompt 38). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge do Muse é a aprovação; decisão "opção A" de 25/10).
-- Só contas is_teste e o anúncio [TESTE QA] 330ebf37. Rollback: supabase/producao/rollback/0247_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  -- Contas de teste (por e-mail E is_teste: em qualquer outra base, nada acontece).
  v_dono uuid;
  v_morador uuid;
  v_parceiro_user uuid;
  -- O anúncio [TESTE QA] escolhido (ativo, sem contrato; não é o ddf86c66, que tem a jornada 11281a61).
  c_imovel constant uuid := '330ebf37-fca4-4f8a-88d9-47614bc56674';
  -- Ids fixos de tudo o que este script cria: o desfazer apaga por eles.
  c_contrato constant uuid := 'd5d50247-0000-4000-8000-00000000c001';
  c_bloco constant uuid := 'd5d50247-0000-4000-8000-00000000b001';
  c_solicitacao constant uuid := 'd5d50247-0000-4000-8000-00000000a001';
  c_parceiro constant uuid := 'd5d50247-0000-4000-8000-00000000a002';
  c_servico constant uuid := 'd5d50247-0000-4000-8000-00000000a003';
  c_vinculo constant uuid := 'd5d50247-0000-4000-8000-00000000a004';
  v_pedidos jsonb;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  select id into v_parceiro_user from public.profiles where lower(email) = 'proprietario3cnpj@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null or v_parceiro_user is null then
    raise notice '0247: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and status = 'active' and title like '[TESTE QA%') then
    raise notice '0247: anúncio [TESTE QA] 330ebf37 ausente, inativo ou de outro dono; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where id = c_contrato) then
    raise notice '0247: dados da prova já existem; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.contratos where property_id = c_imovel and status = 'ativo') then
    raise notice '0247: o anúncio de teste já tem contrato ativo; nada a fazer (sem sobreposição)';
    return;
  end if;
  if exists (select 1 from public.parceiros where user_id = v_parceiro_user) then
    raise notice '0247: a conta de teste do parceiro já é parceira; nada a fazer';
    return;
  end if;

  -- 1) Parceiro de limpeza de teste, aprovado (solicitação ativada) e publicado, com um serviço de limpeza.
  insert into public.parceiro_solicitacoes (id, user_id, email, nome, tipo_pessoa, documento, categorias, cidades, descricao, status, decidido_em, origem)
  values (c_solicitacao, v_parceiro_user, 'proprietario3cnpj@vivanomads.com.br', '[TESTE QA] Limpeza D-5', 'pj', '00000000000000',
          array['limpeza'], array['Uberlândia'], 'Conta de teste da prova do disparo D-5 (Onda 2).', 'ativada', now(), 'suporte');
  insert into public.parceiros (id, user_id, solicitacao_id, tipo_pessoa, documento, nome_publico, slug, categorias, cidades, descricao_curta, status, publicado_em)
  values (c_parceiro, v_parceiro_user, c_solicitacao, 'pj', '00000000000000', '[TESTE QA] Limpeza D-5', 'teste-qa-limpeza-d5',
          array['limpeza'], array['Uberlândia'], 'Parceiro de teste da prova do disparo D-5.', 'publicado', now());
  insert into public.parceiro_servicos (id, parceiro_id, categoria, titulo, preco_base, unidade, ativo)
  values (c_servico, c_parceiro, 'limpeza', 'Limpeza completa (teste)', 250, 'por serviço', true);

  -- 2) Vínculo de limpeza ATIVO e AUTOMÁTICO com o anúncio de teste (o pedido nasce e já vai ao parceiro).
  insert into public.imovel_parceiros (id, property_id, categoria, parceiro_id, servico_id, modo, status, respondido_em)
  values (c_vinculo, c_imovel, 'limpeza', c_parceiro, c_servico, 'automatico', 'ativo', now());

  -- 3) A estadia: 01/10/2026 a 31/10/2026, ativa, assinada pelas duas partes. Saída 31/10 → entra na janela D-5 na
  -- rodada de 26/10 (13:00 UTC). O trigger pedido_atendido_no_contrato marcaria os pedidos de moradia da Ana como
  -- atendidos: o status de cada um é guardado antes e devolvido logo depois (nada muda fora do que é criado aqui).
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb) into v_pedidos
    from public.pedidos_moradia where inquilino_id = v_morador;
  insert into public.contratos (id, property_id, tenant_id, owner_plan, faixa, prazo_total_dias, aluguel_mensal, tamanho_bloco_meses,
                                comissao_percent, comissao_valor, qtd_ocupantes, status, garantia,
                                assinado_proprietario_em, assinado_inquilino_em)
  values (c_contrato, c_imovel, v_morador, 'free', 'media_estadia', 31, 3200, 1, 0.12, 384, 1, 'ativo', 'caucao',
          '2026-09-30 15:00:00+00', '2026-09-30 15:30:00+00');
  insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status)
  values (c_bloco, c_contrato, 1, '2026-10-01', '2026-10-31', 1, 3200, 3200, 'ativo');
  update public.pedidos_moradia pm
     set status = antes.status
    from jsonb_to_recordset(v_pedidos) as antes(id uuid, status text)
   where pm.id = antes.id and pm.status is distinct from antes.status;

  raise notice '0247: prova D-5 criada — contrato VN-CT-D5D50247 (saída 31/10/2026), parceiro de limpeza de teste e vínculo ativo';
end;
$$;

-- Conferência (somente leitura):
--   select c.id, c.status, b.inicio, b.fim, c.assinado_proprietario_em is not null ap, c.assinado_inquilino_em is not null ai
--     from public.contratos c join public.contrato_blocos b on b.contrato_id = c.id
--    where c.id = 'd5d50247-0000-4000-8000-00000000c001';                       -- ativo, 2026-10-01 → 2026-10-31, true, true
--   select numero, is_teste from public.documentos_registro where ref_id = 'd5d50247-0000-4000-8000-00000000c001'; -- VN-CT-D5D50247, true
--   select status, modo, categoria from public.imovel_parceiros where id = 'd5d50247-0000-4000-8000-00000000a004'; -- ativo, automatico, limpeza
--   select status from public.parceiros where id = 'd5d50247-0000-4000-8000-00000000a002';                        -- publicado

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261025000247', '0247_dados_teste_prova_d5',
       array['-- conteúdo em supabase/migrations/0247_dados_teste_prova_d5.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261025000247');
commit;
