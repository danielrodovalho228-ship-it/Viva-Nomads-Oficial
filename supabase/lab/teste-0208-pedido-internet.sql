-- Laboratório (nunca em produção): prova da 0208 — Pedido de Moradia com "internet medida a partir de" (Prompt 57, fase 2).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0208-pedido-internet.sql
begin;
insert into auth.users (id, email) values
  ('57200000-0000-4000-8000-0000000000d1', 'lab-572-dono@teste.vivanomads.com.br'),
  ('57200000-0000-4000-8000-0000000000a1', 'lab-572-inquilino@teste.vivanomads.com.br');
insert into profiles (id) values ('57200000-0000-4000-8000-0000000000d1'), ('57200000-0000-4000-8000-0000000000a1')
  on conflict (id) do nothing;
-- b1: medido 320 Mbps · b2: medido 80 Mbps (informou 500) · b3: só informado 500 · b4: medição vencida (400).
insert into properties (id, owner_id, title, city, state, monthly_price, max_guests, status, internet_mbps)
values ('57200000-0000-4000-8000-0000000000b1', '57200000-0000-4000-8000-0000000000d1', 'Lab 572 medido 320', 'Uberlândia', 'MG', 2000, 2, 'active', null),
       ('57200000-0000-4000-8000-0000000000b2', '57200000-0000-4000-8000-0000000000d1', 'Lab 572 medido 80', 'Uberlândia', 'MG', 2000, 2, 'active', 500),
       ('57200000-0000-4000-8000-0000000000b3', '57200000-0000-4000-8000-0000000000d1', 'Lab 572 só informado', 'Uberlândia', 'MG', 2000, 2, 'active', 500),
       ('57200000-0000-4000-8000-0000000000b4', '57200000-0000-4000-8000-0000000000d1', 'Lab 572 vencida', 'Uberlândia', 'MG', 2000, 2, 'active', null);
insert into qualification_checklists (property_id, owner_id, document_status)
select id, '57200000-0000-4000-8000-0000000000d1', 'approved' from properties where id::text like '57200000-%';
insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, distancia_m, validada, origem, medido_em, valido_ate) values
  ('57200000-0000-4000-8000-0000000000b1', '57200000-0000-4000-8000-0000000000d1', 'dono', 320, 40, 10, 20, true, 'cadastro', now() - interval '2 days', now() + interval '5 months'),
  ('57200000-0000-4000-8000-0000000000b2', '57200000-0000-4000-8000-0000000000d1', 'dono', 80, 20, 15, 20, true, 'cadastro', now() - interval '2 days', now() + interval '5 months'),
  ('57200000-0000-4000-8000-0000000000b4', '57200000-0000-4000-8000-0000000000d1', 'dono', 400, 40, 10, 20, true, 'cadastro', now() - interval '7 months', now() - interval '1 day');

-- 1) Só 50, 100 ou 300 (os chips da busca).
do $$ begin
  insert into pedidos_moradia (inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, expira_em, internet_min_mbps)
  values ('57200000-0000-4000-8000-0000000000a1', 'Uberlândia', 'MG', current_date + 10, 3, 2500, 1, 'outro', now() + interval '30 days', 75);
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: internet_min_mbps fora dos chips é recusado';
end $$;

-- 2) Sem exigência: todos os quatro são compatíveis (nada muda).
insert into pedidos_moradia (id, inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, expira_em)
values ('57200000-0000-4000-8000-0000000000c1', '57200000-0000-4000-8000-0000000000a1', 'Uberlândia', 'MG', current_date + 10, 3, 2500, 1, 'outro', now() + interval '30 days');
select 'sem internet no pedido: os 4 imóveis compatíveis' as caso, count(*) filter (where situacao = 'compativel') = 4 as ok
  from compatibilidade_pedidos('57200000-0000-4000-8000-0000000000c1', null, '57200000-0000-4000-8000-0000000000d1');

-- 3) 100 Mbps: só o medido 320. Medido abaixo, só informado e medição vencida ficam de fora.
update pedidos_moradia set internet_min_mbps = 100 where id = '57200000-0000-4000-8000-0000000000c1';
select 'pedido 100 Mbps: só o medido 320' as caso,
       array_agg(imovel_id order by imovel_id) filter (where situacao = 'compativel') = array['57200000-0000-4000-8000-0000000000b1'::uuid] as ok
  from compatibilidade_pedidos('57200000-0000-4000-8000-0000000000c1', null, '57200000-0000-4000-8000-0000000000d1');
select 'regra fixa: quem não passa vai para "demais" (nunca "quase")' as caso, bool_and(situacao = 'demais') as ok
  from compatibilidade_pedidos('57200000-0000-4000-8000-0000000000c1', null, '57200000-0000-4000-8000-0000000000d1')
 where imovel_id <> '57200000-0000-4000-8000-0000000000b1';

-- 4) 50 Mbps: entram os dois medidos (320 e 80).
update pedidos_moradia set internet_min_mbps = 50 where id = '57200000-0000-4000-8000-0000000000c1';
select 'pedido 50 Mbps: os dois medidos' as caso, count(*) filter (where situacao = 'compativel') = 2 as ok
  from compatibilidade_pedidos('57200000-0000-4000-8000-0000000000c1', null, '57200000-0000-4000-8000-0000000000d1');
rollback;
