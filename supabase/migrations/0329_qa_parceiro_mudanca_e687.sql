-- 0329 — QA (E687): massa do RAMO POSITIVO do parceiro de Mudança.
--
-- O E687 (#3292, na main) faz a empresa e o veículo da categoria Mudança chegarem ao parceiro aprovado. A prova negativa
-- (quem não é de Mudança não os vê) já tem conta; faltava um parceiro de Mudança APROVADO numa conta de teste para ver
-- a própria empresa e o veículo no painel. Esta migração cria esse parceiro, só dado, só conta is_teste.
--   conta:    inquilino2@vivanomads.com.br (is_teste, sem parceiro hoje)
--   parceiro: "[TESTE QA] Mudança E687", categoria mudanca, Uberlândia, publicado, com o serviço "Mudança local (teste E687)"
--   dados da categoria: empresa e veículo FICTÍCIOS, no pedido de origem (parceiro_solicitacoes) e no parceiro
-- Documento de teste (zeros): conta nenhuma real tem esse número. Ids fixos a0329… para o rollback.
-- Sem tocar em anúncios, contratos, pedidos, chaves nem contas reais.

do $$
declare
  v_user uuid;
  c_solicitacao constant uuid := 'a0329000-0000-4000-8000-000000000010';
  c_parceiro constant uuid := 'a0329000-0000-4000-8000-000000000011';
  c_servico constant uuid := 'a0329000-0000-4000-8000-000000000012';
  c_dados constant jsonb := jsonb_build_object('empresa', '[TESTE QA] Mudanças Teste E687 Ltda', 'veiculo', 'Caminhão baú de teste (sem placa real)');
begin
  select id into v_user from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_user is null then
    raise notice '0329: conta de teste inquilino2 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.parceiros where user_id = v_user or id = c_parceiro)
     or exists (select 1 from public.parceiro_solicitacoes where user_id = v_user or id = c_solicitacao) then
    raise notice '0329: a conta de teste já tem pedido ou parceiro; nada a fazer';
    return;
  end if;

  insert into public.parceiro_solicitacoes (id, user_id, email, nome, tipo_pessoa, documento, categorias, cidades, descricao, status, decidido_em, origem, dados_categoria)
  values (c_solicitacao, v_user, 'inquilino2@vivanomads.com.br', '[TESTE QA] Mudança E687', 'pj', '00000000000000',
          array['mudanca'], array['Uberlândia'], 'Conta de teste do ramo positivo do E687 (parceiro de Mudança aprovado).', 'ativada', now(), 'suporte', c_dados);
  insert into public.parceiros (id, user_id, solicitacao_id, tipo_pessoa, documento, nome_publico, slug, categorias, cidades, descricao_curta, status, publicado_em, dados_categoria)
  values (c_parceiro, v_user, c_solicitacao, 'pj', '00000000000000', '[TESTE QA] Mudança E687', 'teste-qa-mudanca-e687',
          array['mudanca'], array['Uberlândia'], 'Parceiro de teste de Mudança (E687).', 'publicado', now(), c_dados);
  insert into public.parceiro_servicos (id, parceiro_id, categoria, titulo, preco_base, unidade, ativo)
  values (c_servico, c_parceiro, 'mudanca', 'Mudança local (teste E687)', 600, 'por serviço', true);
end $$;
