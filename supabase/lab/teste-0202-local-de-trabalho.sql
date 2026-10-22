-- Laboratório (nunca em produção): prova da 0202 — busca pelo local de trabalho (Prompt 37).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0202-local-de-trabalho.sql
begin;
insert into auth.users (id, email) values
  ('37000000-0000-4000-8000-0000000000d1', 'lab-37-dono@teste.vivanomads.com.br'),
  ('37000000-0000-4000-8000-0000000000a1', 'lab-37-medica@teste.vivanomads.com.br'),
  ('37000000-0000-4000-8000-0000000000e1', 'lab-37-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('37000000-0000-4000-8000-0000000000d1'), ('37000000-0000-4000-8000-0000000000a1'), ('37000000-0000-4000-8000-0000000000e1')
  on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, state, monthly_price, max_guests, status, lat, lng)
values ('37000000-0000-4000-8000-0000000000b1', '37000000-0000-4000-8000-0000000000d1', 'Apto Lab 37 perto', 'Uberlândia', 'MG', 2000, 2, 'active', -18.884, -48.259),
       ('37000000-0000-4000-8000-0000000000b2', '37000000-0000-4000-8000-0000000000d1', 'Apto Lab 37 longe', 'Uberlândia', 'MG', 2000, 2, 'active', -18.950, -48.300);
insert into qualification_checklists (property_id, owner_id, document_status)
values ('37000000-0000-4000-8000-0000000000b1', '37000000-0000-4000-8000-0000000000d1', 'approved'),
       ('37000000-0000-4000-8000-0000000000b2', '37000000-0000-4000-8000-0000000000d1', 'approved');
update destinos set lat = -18.8825, lng = -48.2590 where slug = 'hc-ufu';

-- 1) Destinos: a lista inicial nasce inativa; ativo exige ponto; anônimo lê só os ativos; só admin grava.
select 'lista inicial inativa (HC-UFU e os dois campi)' as caso, count(*) = 3 and bool_and(not ativo) as ok
  from destinos where slug in ('hc-ufu', 'ufu-umuarama', 'ufu-santa-monica');
do $$ begin
  update destinos set ativo = true where slug = 'ufu-umuarama';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: destino sem ponto conferido não pode ser ativado';
end $$;
update destinos set ativo = true where slug = 'hc-ufu';
set local role anon;
select 'anônimo lê só os ativos' as caso, array_agg(slug order by slug) = array['hc-ufu'] as ok
  from destinos where slug in ('hc-ufu', 'ufu-umuarama', 'ufu-santa-monica');
reset role;
select set_config('request.jwt.claim.sub', '37000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
do $$ begin
  insert into destinos (slug, nome, tipo, cidade, uf) values ('lab-invasor', 'Invasor', 'outro', 'Uberlândia', 'MG');
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: quem não é admin não cadastra destino';
end $$;
reset role;

-- 2) Cache: o cliente não lê nem grava; mudar o ponto do imóvel ou do destino apaga as linhas dele.
insert into tempos_deslocamento (property_id, destino_chave, modo, minutos, metros)
select '37000000-0000-4000-8000-0000000000b1', 'd:' || id, 'carro', 7.5, 2100 from destinos where slug = 'hc-ufu';
insert into tempos_deslocamento (property_id, destino_chave, modo, minutos, metros)
select '37000000-0000-4000-8000-0000000000b2', 'd:' || id, 'carro', 34, 12000 from destinos where slug = 'hc-ufu';
insert into tempos_deslocamento (property_id, destino_chave, modo, minutos, metros)
values ('37000000-0000-4000-8000-0000000000b1', 'p:-18.919,-48.260', 'a_pe', 22, 1800);
select set_config('request.jwt.claim.sub', '37000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
do $$ begin
  perform 1 from tempos_deslocamento limit 1;
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: nem o dono do imóvel lê o cache (só o servidor)';
end $$;
reset role;
do $$ begin
  insert into tempos_deslocamento (property_id, destino_chave, modo, minutos) values ('37000000-0000-4000-8000-0000000000b1', 'p:-18.9187,-48.26', 'carro', 1);
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: chave de endereço digitado só com 3 casas';
end $$;

-- 3) Local de trabalho: só a própria pessoa lê; o cliente não grava direto; formato validado.
update profiles set local_trabalho = '{"rotulo":"Av. Pará, Umuarama","lat":-18.884,"lng":-48.259,"modo_preferido":"carro"}'
 where id = '37000000-0000-4000-8000-0000000000a1';
select set_config('request.jwt.claim.sub', '37000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'outra pessoa não lê o local de trabalho' as caso, count(*) = 0 as ok
  from profiles where id = '37000000-0000-4000-8000-0000000000a1';
reset role;
select set_config('request.jwt.claim.sub', '37000000-0000-4000-8000-0000000000a1', true);
set local role authenticated;
select 'a própria pessoa lê o seu' as caso, local_trabalho ->> 'rotulo' = 'Av. Pará, Umuarama' as ok
  from profiles where id = '37000000-0000-4000-8000-0000000000a1';
do $$ begin
  update profiles set local_trabalho = '{"rotulo":"x","lat":0,"lng":0}' where id = '37000000-0000-4000-8000-0000000000a1';
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: o local de trabalho é gravado só pelo servidor';
end $$;
reset role;
do $$ begin
  update profiles set local_trabalho = '{"rotulo":"Av. Pará","lat":-18.88,"lng":-48.26,"ate":25}' where id = '37000000-0000-4000-8000-0000000000a1';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: "até" só 10, 15, 20, 30 ou 45';
end $$;
select 'chave do destino igual à do código' as caso,
       chave_destino('{"rotulo":"x","lat":-18.91874,"lng":-48.26}') = 'p:-18.919,-48.260'
       and chave_destino('{"rotulo":"x","lat":1,"lng":1,"destino_id":"37000000-0000-4000-8000-0000000000f1"}') = 'd:37000000-0000-4000-8000-0000000000f1' as ok;

-- 4) Pedido com "até 20 min de carro até o HC-UFU": só o imóvel dentro do tempo é compatível.
insert into pedidos_moradia (id, inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, expira_em, destino)
select '37000000-0000-4000-8000-0000000000c1', '37000000-0000-4000-8000-0000000000a1', 'Uberlândia', 'MG', current_date + 10, 3, 2500, 1,
       'outro', now() + interval '30 days',
       jsonb_build_object('destino_id', id, 'rotulo', 'o HC-UFU', 'lat', -18.8825, 'lng', -48.259, 'modo_preferido', 'carro', 'ate', 20)
  from destinos where slug = 'hc-ufu';
select 'pedido até 20 min: o de ~10 min é compatível' as caso, situacao = 'compativel' as ok
  from compatibilidade_pedidos('37000000-0000-4000-8000-0000000000c1', '37000000-0000-4000-8000-0000000000b1', null);
select 'pedido até 20 min: o de ~35 min não é' as caso, coalesce(bool_and(situacao <> 'compativel'), true) as ok
  from compatibilidade_pedidos('37000000-0000-4000-8000-0000000000c1', '37000000-0000-4000-8000-0000000000b2', null);
update pedidos_moradia set destino = destino - 'ate' where id = '37000000-0000-4000-8000-0000000000c1';
select 'sem "até", o tempo não tira ninguém' as caso, situacao = 'compativel' as ok
  from compatibilidade_pedidos('37000000-0000-4000-8000-0000000000c1', '37000000-0000-4000-8000-0000000000b2', null);

-- 5) Gatilhos de limpeza do cache.
update properties set lat = -18.890, lng = -48.262 where id = '37000000-0000-4000-8000-0000000000b1';
select 'novo ponto do imóvel apaga os tempos dele' as caso, count(*) = 0 as ok
  from tempos_deslocamento where property_id = '37000000-0000-4000-8000-0000000000b1';
update destinos set lat = -18.8830 where slug = 'hc-ufu';
select 'novo ponto do destino apaga os tempos dele' as caso, count(*) = 0 as ok
  from tempos_deslocamento t join destinos d on t.destino_chave = 'd:' || d.id where d.slug = 'hc-ufu';

-- 6) Destinos mais buscados: só a contagem; o cliente não chama nem lê.
select registrar_busca_destino(id) from destinos where slug = 'hc-ufu';
select registrar_busca_destino(id) from destinos where slug = 'hc-ufu';
select registrar_busca_destino(id) from destinos where slug = 'ufu-umuarama';
select 'contagem por destino ativo e dia (inativo não conta)' as caso,
       (select sum(n) from destinos_buscas_dia b join destinos d on d.id = b.destino_id where d.slug = 'hc-ufu') = 2
       and not exists (select 1 from destinos_buscas_dia b join destinos d on d.id = b.destino_id where d.slug = 'ufu-umuarama') as ok;
set local role anon;
do $$ begin
  perform registrar_busca_destino(gen_random_uuid());
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: só o servidor conta as buscas';
end $$;
reset role;
rollback;
