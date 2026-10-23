-- Laboratório (nunca em produção): prova da 0210 — padrão mínimo de conforto + prazo de solução (Prompt 59).
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado: todas as linhas "ok" = t e os NOTICE "ok: …".
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0210-conforto-manutencao.sql
begin;
insert into auth.users (id, email) values
  ('59000000-0000-4000-8000-0000000000d1', 'lab-59-dono@teste.vivanomads.com.br'),
  ('59000000-0000-4000-8000-0000000000e1', 'lab-59-morador@teste.vivanomads.com.br'),
  ('59000000-0000-4000-8000-0000000000f1', 'lab-59-terceiro@teste.vivanomads.com.br');
insert into profiles (id) values
  ('59000000-0000-4000-8000-0000000000d1'), ('59000000-0000-4000-8000-0000000000e1'), ('59000000-0000-4000-8000-0000000000f1')
  on conflict (id) do nothing;
insert into properties (id, owner_id, title, city, monthly_price, status, photo_count)
values ('59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000d1', 'Studio Lab 59', 'Uberlândia', 2500, 'draft', 8);
insert into qualification_checklists (property_id, owner_id, document_status)
values ('59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000d1', 'approved');

-- 1) A lista do banco é a da versão 1 (o teste unitário compara com src/config/conforto-minimo.ts).
select 'lista com 10 itens ou mais (a 0213 leva a 12)' as caso, cardinality(public.conforto_chaves()) >= 10 as ok;

-- 2) Publicar numa sessão de usuário sem o padrão mínimo é recusado, mesmo contornando a tela.
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
do $$ begin
  update properties set status = 'active' where id = '59000000-0000-4000-8000-0000000000b1';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: publicar sem o padrão mínimo é recusado (%)', sqlerrm;
end $$;
-- O dono não grava a declaração direto (só o servidor).
do $$ begin
  insert into conforto_declaracoes (property_id, chave, confirmado) values ('59000000-0000-4000-8000-0000000000b1', 'agua_quente', true);
  raise exception 'DEVIA_NEGAR';
exception when insufficient_privilege then raise notice 'ok: o dono não grava a declaração direto';
end $$;
reset role;

-- 3) Com 9 de 10, ainda recusa; com os 10, publica.
insert into conforto_declaracoes (property_id, chave, confirmado, confirmado_por, confirmado_em)
select '59000000-0000-4000-8000-0000000000b1', k, true, '59000000-0000-4000-8000-0000000000d1', now()
  from unnest(public.conforto_chaves()) k where k <> 'mobilia_das_fotos';
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
do $$ begin
  update properties set status = 'active' where id = '59000000-0000-4000-8000-0000000000b1';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: com 9 de 10 ainda recusa';
end $$;
reset role;
insert into conforto_declaracoes (property_id, chave, confirmado, confirmado_por, confirmado_em)
values ('59000000-0000-4000-8000-0000000000b1', 'mobilia_das_fotos', true, '59000000-0000-4000-8000-0000000000d1', now());
-- Com a 0213 (lista versão 2), a lista atual inteira confirmada na versão atual (sem a 0213, nada muda: os 10 já estão).
insert into conforto_declaracoes (property_id, chave, confirmado, confirmado_por, confirmado_em, versao_lista)
select '59000000-0000-4000-8000-0000000000b1', k, true, '59000000-0000-4000-8000-0000000000d1', now(), 2 from unnest(public.conforto_chaves()) k
on conflict (property_id, chave) do update set confirmado = true, versao_lista = 2;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
update properties set status = 'active' where id = '59000000-0000-4000-8000-0000000000b1';
select 'com os 10 confirmados, publica' as caso, (select status::text from properties where id = '59000000-0000-4000-8000-0000000000b1') = 'active' as ok;
-- O dono lê as próprias declarações; o terceiro não.
select 'dono lê as declarações' as caso, count(*) = cardinality(public.conforto_chaves()) as ok from conforto_declaracoes where property_id = '59000000-0000-4000-8000-0000000000b1';
reset role;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'terceiro não lê' as caso, count(*) = 0 as ok from conforto_declaracoes where property_id = '59000000-0000-4000-8000-0000000000b1';
reset role;

-- 4) Prazo de adequação: o servidor (service role) grava; o dono lê e não muda.
insert into conforto_adequacao (property_id, prazo_ate) values ('59000000-0000-4000-8000-0000000000b1', now() + interval '30 days')
  on conflict (property_id) do update set prazo_ate = excluded.prazo_ate;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê o prazo' as caso, count(*) = 1 as ok from conforto_adequacao where property_id = '59000000-0000-4000-8000-0000000000b1';
do $$ begin
  update conforto_adequacao set prazo_ate = now() + interval '900 days' where property_id = '59000000-0000-4000-8000-0000000000b1';
  if found then raise exception 'DEVIA_NEGAR'; end if;
  raise notice 'ok: o dono não muda o próprio prazo (nenhuma linha)';
exception when insufficient_privilege then raise notice 'ok: o dono não muda o próprio prazo';
end $$;
reset role;

-- 5) Conferência de entrada: a seção trava depois do fechamento.
insert into contratos (id, property_id, tenant_id, faixa, prazo_total_dias, aluguel_mensal, qtd_ocupantes, status)
values ('59000000-0000-4000-8000-0000000000c1', '59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000e1', 'media_estadia', 90, 2500, 1, 'ativo');
insert into conferencias (id, contrato_id, tipo) values ('59000000-0000-4000-8000-0000000000a1', '59000000-0000-4000-8000-0000000000c1', 'entrada');
insert into conferencia_conforto (conferencia_id, chave, confere, texto, autor_id)
values ('59000000-0000-4000-8000-0000000000a1', 'agua_quente', false, 'Chuveiro frio', '59000000-0000-4000-8000-0000000000e1');
do $$ begin
  insert into conferencia_conforto (conferencia_id, chave, confere) values ('59000000-0000-4000-8000-0000000000a1', 'iluminacao', false);
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: "não confere" exige o texto';
end $$;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'morador lê a própria seção' as caso, count(*) = 1 as ok from conferencia_conforto where conferencia_id = '59000000-0000-4000-8000-0000000000a1';
reset role;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
select 'dono lê a seção do contrato' as caso, count(*) = 1 as ok from conferencia_conforto where conferencia_id = '59000000-0000-4000-8000-0000000000a1';
reset role;
update conferencias set fechada_em = now(), fechamento_hash = repeat('a', 64), fechamento_motivo = 'duas_respostas'
 where id = '59000000-0000-4000-8000-0000000000a1';
do $$ begin
  update conferencia_conforto set confere = true where conferencia_id = '59000000-0000-4000-8000-0000000000a1';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: conferência fechada trava o padrão mínimo';
end $$;

-- 6) Pendência: decisão só com data; morador e dono leem; terceiro não.
insert into conforto_pendencias (id, property_id, contrato_id, conferencia_id, chave, prazo_ate, texto_morador)
values ('59000000-0000-4000-8000-000000000101', '59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000c1',
        '59000000-0000-4000-8000-0000000000a1', 'agua_quente', now() + interval '72 hours', 'Chuveiro frio');
do $$ begin
  update conforto_pendencias set status = 'procedente' where id = '59000000-0000-4000-8000-000000000101';
  raise exception 'DEVIA_RECUSAR';
exception when check_violation then raise notice 'ok: procedente exige a data da decisão';
end $$;
do $$ begin
  insert into conforto_pendencias (property_id, contrato_id, conferencia_id, chave, prazo_ate)
  values ('59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000c1', '59000000-0000-4000-8000-0000000000a1', 'agua_quente', now());
  raise exception 'DEVIA_RECUSAR';
exception when unique_violation then raise notice 'ok: uma pendência por item da conferência';
end $$;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000e1', true);
set local role authenticated;
select 'morador lê a pendência' as caso, count(*) = 1 as ok from conforto_pendencias where id = '59000000-0000-4000-8000-000000000101';
do $$ begin
  update conforto_pendencias set status = 'improcedente', decidido_em = now() where id = '59000000-0000-4000-8000-000000000101';
  if found then raise exception 'DEVIA_NEGAR'; end if;
  raise notice 'ok: ninguém decide a pendência pela sessão (nenhuma linha)';
exception when insufficient_privilege then raise notice 'ok: ninguém decide a pendência pela sessão';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000f1', true);
set local role authenticated;
select 'terceiro não lê a pendência' as caso, count(*) = 0 as ok from conforto_pendencias;
reset role;

-- 7) Manutenção: o dono não reclassifica nem marca no passado; marca agora; o servidor do admin reclassifica.
insert into service_orders (id, property_id, tenant_id, owner_id, category, priority, description, opened_at, contrato_id)
values ('59000000-0000-4000-8000-000000000201', '59000000-0000-4000-8000-0000000000b1', '59000000-0000-4000-8000-0000000000e1',
        '59000000-0000-4000-8000-0000000000d1', 'hidraulica', 'urgente', 'Vazamento', now() - interval '20 hours', '59000000-0000-4000-8000-0000000000c1');
select set_config('request.jwt.claim.sub', '59000000-0000-4000-8000-0000000000d1', true);
set local role authenticated;
do $$ begin
  update service_orders set priority = 'baixa' where id = '59000000-0000-4000-8000-000000000201';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: o dono não muda a prioridade';
end $$;
do $$ begin
  update service_orders set provisoria_em = now() - interval '10 hours' where id = '59000000-0000-4000-8000-000000000201';
  raise exception 'DEVIA_RECUSAR';
exception when insufficient_privilege then raise notice 'ok: o dono não marca a provisória no passado';
end $$;
update service_orders set provisoria_em = now() where id = '59000000-0000-4000-8000-000000000201';
select 'dono marca a provisória agora' as caso, provisoria_em is not null as ok from service_orders where id = '59000000-0000-4000-8000-000000000201';
reset role;
-- O admin reclassifica pelo servidor (service role, depois do portão do admin com 2 etapas).
set local role service_role;
update service_orders set priority = 'media', prioridade_original = 'urgente', reclassificada_por = '59000000-0000-4000-8000-0000000000f1',
       reclassificada_em = now(), reclassificacao_motivo = 'Vazamento pequeno, sem risco'
 where id = '59000000-0000-4000-8000-000000000201';
reset role;
select 'admin reclassifica com motivo' as caso, priority::text = 'media' and prioridade_original::text = 'urgente' as ok
  from service_orders where id = '59000000-0000-4000-8000-000000000201';
insert into service_order_eventos (service_order_id, papel, tipo) values ('59000000-0000-4000-8000-000000000201', 'admin', 'reclassificada');
select 'histórico aceita os tipos novos' as caso, count(*) = 1 as ok from service_order_eventos where service_order_id = '59000000-0000-4000-8000-000000000201';
rollback;
