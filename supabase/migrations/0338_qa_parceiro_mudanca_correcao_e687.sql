-- 0338 — QA (E687, correção da 0329): a massa do RAMO POSITIVO do parceiro de Mudança nunca nasceu em produção.
--
-- A 0329 foi registrada (20261107000329), mas em 11/11 não há nenhum parceiro de Mudança no banco: a guarda dela parava
-- se a conta inquilino2 tivesse qualquer pedido de parceiro, e a conta já tinha um pedido de LIMPEZA RECUSADO. Sem esse
-- parceiro, a QA não tem onde ver a empresa e o veículo no painel (o código do E687, 0326 + painel, está na main).
-- Esta migração cria a MESMA massa da 0329 (mesmos ids fixos a0329…, mesmos dados fictícios), só com a guarda correta:
-- pedido fechado (recusado) não impede; parceiro existente ou pedido aberto, sim. Só dado, só conta is_teste; o pedido
-- recusado não é tocado. Sem anúncios, contratos, chaves nem contas reais. Idempotente.
-- Desfazer: supabase/producao/rollback/0338_rollback.sql (remove só as linhas a0329…).
--   conta:    inquilino2@vivanomads.com.br (is_teste)
--   parceiro: "[TESTE QA] Mudança E687", categoria mudanca, Uberlândia, publicado, serviço "Mudança local (teste E687)"
--   dados da categoria: empresa e veículo FICTÍCIOS, no pedido de origem e no parceiro. Documento de teste (zeros).

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
    raise notice '0338: conta de teste inquilino2 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  -- A 0329 parava se a conta tivesse QUALQUER pedido; inquilino2 tinha um pedido de limpeza RECUSADO (fechado), então
  -- a massa nunca nasceu. Aqui só param: um parceiro na conta (parceiros.user_id é único), um pedido ABERTO (o mesmo
  -- conjunto do índice parceiro_solicitacoes_uma_aberta_conta) ou a massa já existir. O pedido recusado fica intocado.
  if exists (select 1 from public.parceiros where user_id = v_user or id = c_parceiro or slug = 'teste-qa-mudanca-e687')
     or exists (select 1 from public.parceiro_solicitacoes where id = c_solicitacao
                or (user_id = v_user and status in ('aguardando_email', 'pendente', 'aprovada'))) then
    raise notice '0338: a conta de teste já tem parceiro ou pedido aberto, ou a massa já existe; nada a fazer';
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
