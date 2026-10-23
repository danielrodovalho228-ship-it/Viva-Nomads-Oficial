-- Laboratório (nunca em produção): prova da 0212 — níveis, ruído, extras, medição por ponto e lista v2 (Adendo 59.1).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0212-niveis.sql
begin;
insert into auth.users (id, email) values
  ('59100000-0000-4000-8000-0000000000d1', 'lab-591-dono@teste.vivanomads.com.br'),
  ('59100000-0000-4000-8000-0000000000f1', 'lab-591-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values ('59100000-0000-4000-8000-0000000000d1'), ('59100000-0000-4000-8000-0000000000f1') on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, monthly_price, status, photo_count)
values ('59100000-0000-4000-8000-0000000000b1', '59100000-0000-4000-8000-0000000000d1', 'Studio Lab 59.1', 'Uberlândia', 2500, 'draft', 8);
insert into qualification_checklists (property_id, owner_id, document_status)
values ('59100000-0000-4000-8000-0000000000b1', '59100000-0000-4000-8000-0000000000d1', 'approved');

-- 1) Lista versão 2: 12 itens; roupa de cama e banho e os 2 novos pedem a versão 2.
select 'lista com 12 itens' as caso, cardinality(public.conforto_chaves()) = 12 as ok;
select 'versões do critério' as caso, public.conforto_versoes() = '{"roupa_cama_banho": 2, "lavanderia_acesso": 2, "apoio_cama": 2}'::jsonb as ok;

-- 2) Confirmado na versão 1 não basta para os itens da versão 2; reconfirmado, completa.
insert into conforto_declaracoes (property_id, chave, confirmado, versao_lista)
select '59100000-0000-4000-8000-0000000000b1', k, true, 1 from unnest(public.conforto_chaves()) k;
select 'v1 não completa a v2' as caso, not public.conforto_completo('59100000-0000-4000-8000-0000000000b1') as ok;
update conforto_declaracoes set versao_lista = 2
 where property_id = '59100000-0000-4000-8000-0000000000b1' and chave in ('roupa_cama_banho', 'lavanderia_acesso', 'apoio_cama');
select 'reconfirmado completa' as caso, public.conforto_completo('59100000-0000-4000-8000-0000000000b1') as ok;

-- 3) Adequação da v2: anúncio ativo incompleto ganha 30 dias (uma vez; reaplicar não estende).
update conforto_declaracoes set versao_lista = 1 where property_id = '59100000-0000-4000-8000-0000000000b1' and chave = 'apoio_cama';
update properties set status = 'active' where id = '59100000-0000-4000-8000-0000000000b1';
insert into conforto_adequacao (property_id, prazo_ate, versao_lista) values ('59100000-0000-4000-8000-0000000000b1', now() - interval '1 day', 1)
  on conflict (property_id) do update set prazo_ate = excluded.prazo_ate, versao_lista = 1;
insert into public.conforto_adequacao (property_id, prazo_ate, versao_lista)
select p.id, now() + interval '30 days', 2 from public.properties p
 where p.id = '59100000-0000-4000-8000-0000000000b1' and p.status::text = 'active' and not public.conforto_completo(p.id)
on conflict (property_id) do update set prazo_ate = excluded.prazo_ate, lembretes = '{}', versao_lista = 2
 where public.conforto_adequacao.versao_lista < 2;
select '30 dias na v2' as caso, (select prazo_ate > now() + interval '29 days' and versao_lista = 2 from conforto_adequacao where property_id = '59100000-0000-4000-8000-0000000000b1') as ok;

-- 4) nivel_itens: caminho de foto no formato do upload; recusa exige motivo; o dono não grava direto.
insert into nivel_itens (property_id, chave, declarado, foto_path)
values ('59100000-0000-4000-8000-0000000000b1', 'ar_sala', true, '59100000-0000-4000-8000-0000000000d1/0f0e0d0c-0b0a-4000-8000-000000000001.webp');
do $$ begin
  update nivel_itens set foto_status = 'recusada' where property_id = '59100000-0000-4000-8000-0000000000b1' and chave = 'ar_sala';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: recusar foto sem motivo é recusado';
end $$;
do $$ begin
  insert into nivel_itens (property_id, chave, declarado, foto_path) values ('59100000-0000-4000-8000-0000000000b1', 'ar_todos_quartos', true, '../outro/arquivo.png');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: caminho de foto fora do padrão é recusado';
end $$;

-- 5) Medição com ponto; ponto inválido recusado.
do $$ begin
  insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, origem, valido_ate, ponto)
  values ('59100000-0000-4000-8000-0000000000b1', '59100000-0000-4000-8000-0000000000d1', 'dono', 100, 50, 20, true, 'edicao', now() + interval '180 days', 'cozinha');
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: ponto de medição fora da lista é recusado';
end $$;
insert into internet_medicoes (property_id, user_id, papel, download_mbps, upload_mbps, latencia_ms, validada, origem, valido_ate, ponto)
values ('59100000-0000-4000-8000-0000000000b1', '59100000-0000-4000-8000-0000000000d1', 'dono', 100, 50, 20, true, 'edicao', now() + interval '180 days', 'trabalho');
insert into imovel_ruido (property_id, via_intensa, noturno_obra_100m, aviao_ferrovia, isolamento_acustico, classe)
values ('59100000-0000-4000-8000-0000000000b1', true, false, false, false, 'medio');
insert into imovel_extras (property_id, chave) values ('59100000-0000-4000-8000-0000000000b1', 'air_fryer');
insert into imovel_nivel (property_id, nivel) values ('59100000-0000-4000-8000-0000000000b1', 'conforto');

-- 6) Leitura: anônimo vê nível, ruído, extras e a medida por ponto do anúncio ATIVO; não vê os itens/fotos de nível.
set local role anon;
select 'anon vê o nível' as caso, (select nivel from imovel_nivel where property_id = '59100000-0000-4000-8000-0000000000b1') = 'conforto' as ok;
select 'anon vê ruído e extras' as caso, exists (select 1 from imovel_ruido where property_id = '59100000-0000-4000-8000-0000000000b1')
       and exists (select 1 from imovel_extras where property_id = '59100000-0000-4000-8000-0000000000b1') as ok;
select 'anon vê a medida do ponto' as caso, exists (select 1 from internet_medida_ponto_publica where property_id = '59100000-0000-4000-8000-0000000000b1' and ponto = 'trabalho') as ok;
do $$ begin
  perform 1 from nivel_itens limit 1;
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: anônimo não lê os itens de nível';
end $$;
reset role;

-- 7) Terceiro logado não vê os itens de nível; o dono vê; ninguém grava nível pela sessão.
select set_config('request.jwt.claim.sub', '59100000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'terceiro não vê itens de nível' as caso, not exists (select 1 from nivel_itens where property_id = '59100000-0000-4000-8000-0000000000b1') as ok;
do $$ begin
  update imovel_nivel set nivel = 'premium' where property_id = '59100000-0000-4000-8000-0000000000b1';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: sessão de usuário não grava o nível';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '59100000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono vê os próprios itens' as caso, exists (select 1 from nivel_itens where property_id = '59100000-0000-4000-8000-0000000000b1') as ok;
do $$ begin
  insert into imovel_extras (property_id, chave) values ('59100000-0000-4000-8000-0000000000b1', 'tv');
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: dono não grava extras direto (só o servidor)';
end $$;
reset role;
rollback;
