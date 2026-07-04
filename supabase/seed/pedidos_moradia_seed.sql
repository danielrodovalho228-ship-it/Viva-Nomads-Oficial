-- ⚠️  SEED DE SIMULAÇÃO — SOMENTE PREVIEW/TESTE. NUNCA RODE EM PRODUÇÃO. ⚠️
--
-- Popula 3 pedidos de moradia de exemplo (equivalentes ao protótipo: profissional
-- da saúde, corporativo, transição) para testar as telas do Pedido de Moradia
-- sem criar contas reais. Os pedidos são atribuídos a um inquilino EXISTENTE
-- (por padrão, o super admin) — assim aparecem no painel do inquilino e, se você
-- tiver imóvel publicado na cidade, na lista do proprietário.
--
-- Este arquivo fica em supabase/seed/ e NÃO é aplicado automaticamente (não é
-- migração). Rode manualmente só em ambiente de teste. Guard adicional abaixo:
-- aborta se detectar um número alto de imóveis/usuários (heurística de produção).

do $seed$
declare
  inquilino uuid;
  n_users int;
begin
  -- Guard heurístico: em produção há muitos perfis. Ajuste o limite se preciso.
  select count(*) into n_users from profiles;
  if n_users > 50 then
    raise exception 'Abortado: parece PRODUÇÃO (% perfis). Seed é só para teste/preview.', n_users;
  end if;

  -- Inquilino alvo: o super admin (troque o e-mail se quiser outro usuário teste).
  select id into inquilino from profiles where lower(email) = 'dtrodovalho40@gmail.com' limit 1;
  if inquilino is null then
    raise exception 'Nenhum perfil encontrado para atribuir os pedidos. Crie/entre com o usuário antes.';
  end if;

  insert into pedidos_moradia
    (inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, apresentacao, status)
  values
    (inquilino, 'Uberlândia', 'MG', current_date + 10, 6, 3500, 1, 'trabalho_saude',
      'Médica iniciando residência, busco algo mobiliado e tranquilo perto do hospital.', 'ativo'),
    (inquilino, 'Uberlândia', 'MG', current_date + 20, 4, 4500, 2, 'trabalho_corporativo',
      'Projeto de 4 meses na cidade, casal sem filhos, precisamos de home office.', 'ativo'),
    (inquilino, 'Uberlândia', 'MG', current_date + 5, 5, 3000, 4, 'transicao',
      'Família em transição, 2 adultos e 2 crianças, buscando estabilidade por alguns meses.', 'ativo');

  raise notice 'Seed OK: 3 pedidos de moradia criados para o inquilino %.', inquilino;
end $seed$;
