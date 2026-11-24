-- Viva Nomads — aplicar 0329 (QA: parceiro de Mudança aprovado em conta de teste, para o ramo positivo do E687). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0329_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name)
select '20261107000329', '0329_qa_parceiro_mudanca_e687'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000329');

commit;
