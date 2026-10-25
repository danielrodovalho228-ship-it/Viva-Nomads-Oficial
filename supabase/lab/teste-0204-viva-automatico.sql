-- Laboratório (nunca em produção): prova da 0204 — "Viva rodando automático" (Prompt 38).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0204-viva-automatico.sql
begin;
insert into auth.users (id, email) values
  ('38000000-0000-4000-8000-0000000000d1', 'lab-38-dono@teste.vivanomads.com.br'),
  ('38000000-0000-4000-8000-0000000000f1', 'lab-38-limpeza@teste.vivanomads.com.br'),
  ('38000000-0000-4000-8000-0000000000e1', 'lab-38-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('38000000-0000-4000-8000-0000000000d1'), ('38000000-0000-4000-8000-0000000000f1'), ('38000000-0000-4000-8000-0000000000e1')
  on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, monthly_price)
values ('38000000-0000-4000-8000-0000000000b1', '38000000-0000-4000-8000-0000000000d1', 'Apto Lab 38', 'Uberlândia', 2500);
insert into parceiros (id, user_id, tipo_pessoa, documento, nome_publico, slug, categorias, cidades, status)
values ('38000000-0000-4000-8000-0000000000a1', '38000000-0000-4000-8000-0000000000f1', 'pf', '12345678909', 'Limpeza Lab 38', 'limpeza-lab-38', '{limpeza,manutencao}', '{Uberlândia}', 'publicado');
insert into parceiro_servicos (id, parceiro_id, categoria, titulo, preco_base)
values ('38000000-0000-4000-8000-0000000000c1', '38000000-0000-4000-8000-0000000000a1', 'limpeza', 'Limpeza de saída', 180);

-- 1) Vínculo: nasce pendente; um por (imóvel, categoria) entre os não encerrados.
insert into imovel_parceiros (id, property_id, categoria, parceiro_id, servico_id, modo, instrucoes)
values ('38000000-0000-4000-8000-000000000011', '38000000-0000-4000-8000-0000000000b1', 'limpeza', '38000000-0000-4000-8000-0000000000a1',
        '38000000-0000-4000-8000-0000000000c1', 'automatico', 'trocar enxoval, 2 banheiros');
select 'vínculo nasce pendente' as caso, status = 'pendente' as ok from imovel_parceiros where id = '38000000-0000-4000-8000-000000000011';
do $$ begin
  insert into imovel_parceiros (property_id, categoria, parceiro_id) values ('38000000-0000-4000-8000-0000000000b1', 'limpeza', '38000000-0000-4000-8000-0000000000a1');
  raise exception 'DEVIA_RECUSAR';
exception when unique_violation then raise notice 'ok: um vínculo por imóvel e categoria';
end $$;
update imovel_parceiros set status = 'encerrado' where id = '38000000-0000-4000-8000-000000000011';
insert into imovel_parceiros (id, property_id, categoria, parceiro_id, modo)
values ('38000000-0000-4000-8000-000000000012', '38000000-0000-4000-8000-0000000000b1', 'limpeza', '38000000-0000-4000-8000-0000000000a1', 'confirmar');
select 'encerrado libera um vínculo novo na mesma categoria' as caso, count(*) = 2 as ok
  from imovel_parceiros where property_id = '38000000-0000-4000-8000-0000000000b1' and categoria = 'limpeza';
do $$ begin
  insert into imovel_parceiros (property_id, categoria, parceiro_id) values ('38000000-0000-4000-8000-0000000000b1', 'mudanca', '38000000-0000-4000-8000-0000000000a1');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: só limpeza, manutenção, lavanderia e fotografia';
end $$;

-- 2) RLS: dono e parceiro leem; terceiro e anônimo não; ninguém grava pelo cliente.
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê os vínculos do imóvel' as caso, count(*) = 2 as ok from imovel_parceiros;
do $$ begin
  update imovel_parceiros set status = 'ativo' where id = '38000000-0000-4000-8000-000000000012';
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: status só pelo servidor (nem o dono muda)';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'parceiro lê os vínculos dele' as caso, count(*) = 2 as ok from imovel_parceiros;
do $$ begin
  update imovel_parceiros set status = 'ativo' where id = '38000000-0000-4000-8000-000000000012';
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: o aceite do parceiro passa pelo servidor';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não vê nada' as caso, count(*) = 0 as ok from imovel_parceiros;
reset role;
set local role anon;
do $$ begin
  perform 1 from imovel_parceiros;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: anônimo não lê vínculos';
end $$;
reset role;

-- 3) Pedido automático: chave de idempotência única; automático sempre com chave e gatilho; manual nunca.
insert into parceiro_pedidos (codigo, parceiro_id, cliente_id, categoria, descricao, property_id, origem, chave_automacao, gatilho,
                              vinculo_id, janela_inicio, janela_fim, aguardando_dono)
values ('VN-SV-38LAB001', '38000000-0000-4000-8000-0000000000a1', '38000000-0000-4000-8000-0000000000d1', 'limpeza', 'Limpeza depois da saída do morador',
        '38000000-0000-4000-8000-0000000000b1', 'automatico', 'im:limpeza:ct:saida', 'saida_limpeza',
        '38000000-0000-4000-8000-000000000012', '2026-11-20T16:00:00Z', '2026-11-22T14:00:00Z', true);
do $$ begin
  insert into parceiro_pedidos (codigo, parceiro_id, cliente_id, categoria, descricao, origem, chave_automacao, gatilho)
  values ('VN-SV-38LAB002', '38000000-0000-4000-8000-0000000000a1', '38000000-0000-4000-8000-0000000000d1', 'limpeza', 'Repetido', 'automatico', 'im:limpeza:ct:saida', 'saida_limpeza');
  raise exception 'DEVIA_RECUSAR';
exception when unique_violation then raise notice 'ok: um pedido por (imóvel, categoria, contrato, evento)';
end $$;
do $$ begin
  insert into parceiro_pedidos (codigo, parceiro_id, cliente_id, categoria, descricao, origem)
  values ('VN-SV-38LAB003', '38000000-0000-4000-8000-0000000000a1', '38000000-0000-4000-8000-0000000000d1', 'limpeza', 'Sem chave', 'automatico');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: automático sem chave é recusado';
end $$;
do $$ begin
  insert into parceiro_pedidos (codigo, parceiro_id, cliente_id, categoria, descricao, origem, chave_automacao, gatilho)
  values ('VN-SV-38LAB004', '38000000-0000-4000-8000-0000000000a1', '38000000-0000-4000-8000-0000000000d1', 'limpeza', 'Manual com chave', 'manual', 'x', 'saida_limpeza');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: manual nunca leva a chave da automação';
end $$;
select 'pedido automático com janela e aguardando o dono' as caso, aguardando_dono and janela_fim > janela_inicio as ok
  from parceiro_pedidos where codigo = 'VN-SV-38LAB001';
-- O pedido que espera o dono não aparece para o parceiro; o dono vê. Depois do toque, o parceiro vê.
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'parceiro não vê o pedido que espera o dono' as caso, count(*) = 0 as ok from parceiro_pedidos where codigo = 'VN-SV-38LAB001';
reset role;
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono vê o pedido que espera a confirmação dele' as caso, count(*) = 1 as ok from parceiro_pedidos where codigo = 'VN-SV-38LAB001';
reset role;
update parceiro_pedidos set aguardando_dono = false, enviado_em = now() where codigo = 'VN-SV-38LAB001';
select set_config('request.jwt.claim.sub', '38000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'depois do toque do dono, o parceiro vê' as caso, count(*) = 1 as ok from parceiro_pedidos where codigo = 'VN-SV-38LAB001';
reset role;

-- 4) Conferência: "precisa de reparo" nasce falso e segue as travas.
select 'conferencia_itens.precisa_reparo existe e nasce falso' as caso,
       (select column_default from information_schema.columns where table_name = 'conferencia_itens' and column_name = 'precisa_reparo') = 'false' as ok;
rollback;
