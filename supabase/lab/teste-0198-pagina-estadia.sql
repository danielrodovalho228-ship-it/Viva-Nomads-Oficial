-- Laboratório (nunca em produção): prova da 0198 — página da estadia (Prompt 32).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0198-pagina-estadia.sql
begin;
insert into auth.users (id, email) values
  ('32000000-0000-4000-8000-0000000000d1', 'lab-32-dono@teste.vivanomads.com.br'),
  ('32000000-0000-4000-8000-0000000000a1', 'lab-32-morador@teste.vivanomads.com.br'),
  ('32000000-0000-4000-8000-0000000000e1', 'lab-32-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('32000000-0000-4000-8000-0000000000d1'), ('32000000-0000-4000-8000-0000000000a1'), ('32000000-0000-4000-8000-0000000000e1')
  on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, monthly_price)
values ('32000000-0000-4000-8000-0000000000b1', '32000000-0000-4000-8000-0000000000d1', 'Apto Lab 32', 'Uberlândia', 3000);
insert into contratos (id, property_id, tenant_id, faixa, prazo_total_dias, aluguel_mensal, qtd_ocupantes)
values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000b1', '32000000-0000-4000-8000-0000000000a1',
        'media_estadia', 90, 3000, 2);

-- 1) instruções de chegada: o dono grava e lê; o morador e o terceiro não leem direto (só pelo servidor)
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
insert into imovel_instrucoes_chegada (property_id, como_entrar, wifi_rede, wifi_senha)
values ('32000000-0000-4000-8000-0000000000b1', 'Portaria 24 h, nome na lista', 'ApLab', 'senha-lab');
select 'dono lê as instruções' as caso, count(*) = 1 as ok from imovel_instrucoes_chegada;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
select 'morador não lê direto' as caso, count(*) = 0 as ok from imovel_instrucoes_chegada;
do $$ begin
  insert into imovel_instrucoes_chegada (property_id, como_entrar) values ('32000000-0000-4000-8000-0000000000b1', 'x');
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege or unique_violation then raise notice 'ok: morador não grava instruções';
end $$;
reset role;
set local role anon;
do $$ begin
  perform 1 from imovel_instrucoes_chegada;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: anon sem acesso às instruções';
end $$;
reset role;

-- 2) ocupantes: só o servidor grava; teto = qtd_ocupantes; partes leem, terceiro não
insert into contrato_ocupantes (contrato_id, nome, documento, criado_por) values
  ('32000000-0000-4000-8000-0000000000c1', 'Ana Lab', '111.444.777-35', '32000000-0000-4000-8000-0000000000a1'),
  ('32000000-0000-4000-8000-0000000000c1', 'Bruno Lab', 'MG-12.345.678', '32000000-0000-4000-8000-0000000000a1');
do $$ begin
  insert into contrato_ocupantes (contrato_id, nome, documento, criado_por)
  values ('32000000-0000-4000-8000-0000000000c1', 'Carla Lab', '529.982.247-25', '32000000-0000-4000-8000-0000000000a1');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: 3º ocupante acima do limite recusado';
end $$;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê a lista da portaria' as caso, count(*) = 2 as ok from contrato_ocupantes;
do $$ begin
  insert into contrato_ocupantes (contrato_id, nome, documento, criado_por)
  values ('32000000-0000-4000-8000-0000000000c1', 'Direto', '12345678', '32000000-0000-4000-8000-0000000000d1');
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: ninguém grava ocupante direto (só o servidor)';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não lê ocupantes' as caso, count(*) = 0 as ok from contrato_ocupantes;
reset role;

-- 3) notas privadas: o autor lê a própria; a outra parte e o terceiro não; terceiro não grava nota no contrato
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
insert into contrato_notas (contrato_id, autor_id, texto)
values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000d1', 'Trocar o chuveiro antes da entrada');
select 'autor lê a própria nota' as caso, count(*) = 1 as ok from contrato_notas;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
select 'outra parte não lê a nota' as caso, count(*) = 0 as ok from contrato_notas;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não lê a nota' as caso, count(*) = 0 as ok from contrato_notas;
do $$ begin
  insert into contrato_notas (contrato_id, autor_id, texto)
  values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000e1', 'intruso');
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: terceiro não grava nota no contrato';
end $$;
reset role;

-- 4) aditivo: só o servidor grava; um aberto por contrato; a taxa não aparece para o morador
insert into contrato_aditivos (id, contrato_id, numero, proposto_por, papel_proponente, mudancas, resumo, expira_em)
values ('32000000-0000-4000-8000-0000000000f1', '32000000-0000-4000-8000-0000000000c1', 1, '32000000-0000-4000-8000-0000000000a1',
        'inquilino', '{"meses":{"antes":3,"depois":4}}', 'Saída: de 3 para 4 meses', now() + interval '7 days');
insert into contrato_aditivo_taxa (aditivo_id, valor, percentual, base_texto)
values ('32000000-0000-4000-8000-0000000000f1', 300, 0.10, 'R$ 3.000,00 × 1 mês × 10%');
do $$ begin
  insert into contrato_aditivos (contrato_id, numero, proposto_por, papel_proponente, mudancas, resumo, expira_em)
  values ('32000000-0000-4000-8000-0000000000c1', 2, '32000000-0000-4000-8000-0000000000d1', 'proprietario', '{}', 'x', now());
  raise exception 'DEVIA_RECUSAR';
exception when unique_violation then raise notice 'ok: só um aditivo aberto por contrato';
end $$;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
select 'morador vê o aditivo' as caso, count(*) = 1 as ok from contrato_aditivos;
do $$ begin
  perform 1 from contrato_aditivo_taxa;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: morador não lê a taxa do aditivo';
end $$;
do $$ begin
  update contrato_aditivos set status = 'assinado' where id = '32000000-0000-4000-8000-0000000000f1';
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: parte não muda o aditivo direto';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não vê o aditivo' as caso, count(*) = 0 as ok from contrato_aditivos;
reset role;

-- 5) encerramento: "outro" exige texto; um pedido aberto por contrato; terceiro não lê
do $$ begin
  insert into contrato_encerramento_pedidos (contrato_id, pedido_por, papel, motivo)
  values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000a1', 'inquilino', 'outro');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: motivo "outro" sem texto recusado';
end $$;
insert into contrato_encerramento_pedidos (contrato_id, pedido_por, papel, motivo)
values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000a1', 'inquilino', 'mudanca_planos_morador');
do $$ begin
  insert into contrato_encerramento_pedidos (contrato_id, pedido_por, papel, motivo)
  values ('32000000-0000-4000-8000-0000000000c1', '32000000-0000-4000-8000-0000000000d1', 'proprietario', 'acordo_entre_partes');
  raise exception 'DEVIA_RECUSAR';
exception when unique_violation then raise notice 'ok: um pedido de encerramento aberto por contrato';
end $$;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'terceiro não lê o encerramento' as caso, count(*) = 0 as ok from contrato_encerramento_pedidos;
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê o encerramento' as caso, count(*) = 1 as ok from contrato_encerramento_pedidos;
reset role;

-- 7) aplicar_aditivo: tudo ou nada; bloco com pagamento nunca sai; só o serviço executa
insert into contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
  ('32000000-0000-4000-8000-0000000000b7', '32000000-0000-4000-8000-0000000000c1', 1, current_date + 10, current_date + 69, 2, 6000, 3000, 'ativo'),
  ('32000000-0000-4000-8000-0000000000b8', '32000000-0000-4000-8000-0000000000c1', 2, current_date + 70, current_date + 99, 1, 3000, 1500, 'pendente_aceite');
insert into pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por)
values ('32000000-0000-4000-8000-0000000000b7', '32000000-0000-4000-8000-0000000000c1', 'aluguel', 3000, current_date, '32000000-0000-4000-8000-0000000000d1');
update contrato_aditivos set status = 'aceito' where id = '32000000-0000-4000-8000-0000000000f1';
set local role authenticated;
do $$ begin
  perform aplicar_aditivo('32000000-0000-4000-8000-0000000000f1', '{}', '[]', 90, null, null);
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: parte não aplica aditivo direto';
end $$;
reset role;
-- tirar o bloco 1 (que tem pagamento) é recusado e nada muda (o aditivo continua "aceito")
do $$ begin
  perform aplicar_aditivo('32000000-0000-4000-8000-0000000000f1',
    array['32000000-0000-4000-8000-0000000000b7', '32000000-0000-4000-8000-0000000000b8']::uuid[],
    '[]'::jsonb, 30, null, null);
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: bloco com pagamento não sai por aditivo';
end $$;
select 'aditivo recusado não mudou nada' as caso, (select status from contrato_aditivos where id = '32000000-0000-4000-8000-0000000000f1') = 'aceito'
   and (select count(*) from pagamentos_bloco where contrato_id = '32000000-0000-4000-8000-0000000000c1') = 1 as ok;
-- +1 mês: o bloco 2 é atualizado no lugar (com os dois aceites → agendado) e o 3 é criado
select 'aplica +1 mês' as caso, aplicar_aditivo('32000000-0000-4000-8000-0000000000f1',
    array['32000000-0000-4000-8000-0000000000b8']::uuid[],
    jsonb_build_array(
      jsonb_build_object('numero_bloco', 2, 'inicio', current_date + 70, 'fim', current_date + 129, 'meses', 2, 'valor', 6000, 'caucao', 0, 'status', 'agendado')),
    120, 3, null) as ok;
select 'bloco 2 refeito e agendado' as caso, (select meses = 2 and status = 'agendado' and aceite_inquilino_em is not null
   from contrato_blocos where id = '32000000-0000-4000-8000-0000000000b8') as ok;
select 'contrato atualizado' as caso, (select prazo_total_dias = 120 and qtd_ocupantes = 3 from contratos where id = '32000000-0000-4000-8000-0000000000c1') as ok;
select 'aditivo assinado uma vez só' as caso, aplicar_aditivo('32000000-0000-4000-8000-0000000000f1', '{}', '[]', 1, null, null) = false as ok;

-- 6) retenção: apagar ocupantes de contrato encerrado há mais de 90 dias (a rotina faz o mesmo delete)
delete from contrato_ocupantes o using contratos c
 where c.id = o.contrato_id and c.id = '32000000-0000-4000-8000-0000000000c1';
select 'rotina apaga os ocupantes' as caso, count(*) = 0 as ok from contrato_ocupantes
 where contrato_id = '32000000-0000-4000-8000-0000000000c1';
rollback;
