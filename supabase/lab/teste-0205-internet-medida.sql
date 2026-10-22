-- Laboratório (nunca em produção): prova da 0205 — Internet medida no imóvel (Prompt 57).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0205-internet-medida.sql
begin;
insert into auth.users (id, email) values
  ('57000000-0000-4000-8000-0000000000d1', 'lab-57-dono@teste.vivanomads.com.br'),
  ('57000000-0000-4000-8000-0000000000e1', 'lab-57-morador@teste.vivanomads.com.br'),
  ('57000000-0000-4000-8000-0000000000f1', 'lab-57-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('57000000-0000-4000-8000-0000000000d1'), ('57000000-0000-4000-8000-0000000000e1'), ('57000000-0000-4000-8000-0000000000f1')
  on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, monthly_price, status, internet_mbps)
values ('57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'Studio Lab 57', 'Uberlândia', 2500, 'active', 300);

-- Dono: uma validada (vigente), uma não validada mais nova; morador: uma validada.
insert into internet_medicoes (id, property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, distancia_m, validada, motivo_invalida, origem, medido_em, valido_ate) values
  ('57000000-0000-4000-8000-000000000011', '57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'dono', 328, 42, 12, 40, true, null, 'cadastro', now() - interval '2 days', now() + interval '5 months'),
  ('57000000-0000-4000-8000-000000000012', '57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'dono', 900, 90, 5, 4200, false, 'longe', 'edicao', now() - interval '1 day', now() + interval '6 months'),
  ('57000000-0000-4000-8000-000000000013', '57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000e1', 'morador', 120, 20, 30, 10, true, null, 'conferencia_entrada', now(), now() + interval '6 months');

-- 1) Regras da tabela.
do $$ begin
  insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, motivo_invalida, origem, valido_ate)
  values ('57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'dono', 100, 10, 10, true, 'longe', 'edicao', now() + interval '6 months');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: validada não tem motivo';
end $$;
do $$ begin
  insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, origem, valido_ate)
  values ('57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000e1', 'morador', 100, 10, 10, true, 'edicao', now() + interval '6 months');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: morador só mede na conferência de entrada';
end $$;
do $$ begin
  insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, origem, valido_ate)
  values ('57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'dono', 0, 10, 10, true, 'edicao', now() + interval '6 months');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: velocidade zero recusada';
end $$;

-- 2) Pública: só a última VALIDADA do DONO, sem distância/usuário/morador.
select 'pública mostra a validada do dono (328)' as caso, (select download_mbps = 328 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b1') as ok;
select 'pública tem uma linha por imóvel' as caso, (select count(*) = 1 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b1') as ok;
select 'pública sem distância nem usuário' as caso,
       not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'internet_medida_publica' and column_name in ('distancia_m', 'user_id', 'papel')) as ok;
update internet_medicoes set valido_ate = now() - interval '1 minute', medido_em = now() - interval '7 months' where id = '57000000-0000-4000-8000-000000000011';
select 'vencida sai da pública (e a do morador nunca entra)' as caso, not exists (select 1 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b1') as ok;
update internet_medicoes set valido_ate = now() + interval '5 months', medido_em = now() - interval '2 days' where id = '57000000-0000-4000-8000-000000000011';
insert into properties (id, owner_id, title, city, monthly_price, status)
values ('57000000-0000-4000-8000-0000000000b2', '57000000-0000-4000-8000-0000000000d1', 'Rascunho Lab 57', 'Uberlândia', 2500, 'draft');
insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, distancia_m, validada, origem, valido_ate)
values ('57000000-0000-4000-8000-0000000000b2', '57000000-0000-4000-8000-0000000000d1', 'dono', 200, 20, 10, 15, true, 'cadastro', now() + interval '6 months');
select 'rascunho não aparece na pública' as caso, not exists (select 1 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b2') as ok;
select 'informado continua intacto' as caso, (select internet_mbps = 300 from properties where id = '57000000-0000-4000-8000-0000000000b1') as ok;

-- 3) RLS: dono lê as 3 do imóvel; morador lê só a dele; terceiro nada; ninguém grava pelo navegador.
select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê as dos imóveis dele' as caso, (select count(*) = 4 from internet_medicoes) as ok;
do $$ begin
  insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, origem, valido_ate)
  values ('57000000-0000-4000-8000-0000000000b1', '57000000-0000-4000-8000-0000000000d1', 'dono', 999, 99, 1, false, 'edicao', now() + interval '6 months');
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: o navegador não grava medição';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'morador lê só a própria' as caso, (select count(*) = 1 and bool_and(papel = 'morador') from internet_medicoes) as ok;
reset role;
select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'terceiro não lê medição' as caso, (select count(*) = 0 from internet_medicoes) as ok;
select 'terceiro lê a pública' as caso, (select count(*) = 1 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b1') as ok;
reset role;
set local role anon;
select 'anônimo lê a pública' as caso, (select count(*) = 1 from internet_medida_publica where property_id = '57000000-0000-4000-8000-0000000000b1') as ok;
reset role;
rollback;
