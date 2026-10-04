-- 0063 — renovação com aceite das duas partes, tetos, selos, Fundador, expiração.
reset role;
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal, prazo_total_dias) values
 ('dddddd63-0000-0000-0000-000000000002','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000,180);
-- 1º bloco vigente (60 dias, inclusivo) e o 2º PENDENTE (como o registrarContrato grava agora).
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
 ('b6300000-0000-0000-0000-000000000011','dddddd63-0000-0000-0000-000000000002',1, current_date - 70, current_date - 11, 2, 6000, 3000, 'ativo'),
 ('b6300000-0000-0000-0000-000000000012','dddddd63-0000-0000-0000-000000000002',2, current_date + 30, current_date + 89, 2, 6000, 3000, 'pendente_aceite');
select t('ATAQUE@0063','bloco 2 vira agendado sem aceite','falha',$q$update contrato_blocos set status='agendado' where id='b6300000-0000-0000-0000-000000000012'$q$);
select t('ATAQUE@0063','…nem só com o aceite do inquilino','falha',$q$update contrato_blocos set aceite_inquilino_em=now(), status='agendado' where id='b6300000-0000-0000-0000-000000000012'$q$);
select t('NOVO@0063','com os dois aceites vira agendado','passa',$q$update contrato_blocos set aceite_inquilino_em=now(), aceite_proprietario_em=now(), status='agendado' where id='b6300000-0000-0000-0000-000000000012'$q$);
select t('ATAQUE@0063','bloco que passaria de 180 dias','falha',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd63-0000-0000-0000-000000000002',3,current_date+90,current_date+179,3,9000,1000,'pendente_aceite')$q$);
select t('ATAQUE@0063','caução total acima de 3 aluguéis','falha',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd63-0000-0000-0000-000000000002',3,current_date+90,current_date+119,1,3000,3001,'pendente_aceite')$q$);
select t('NOVO@0063','bloco 3 dentro dos tetos (180 dias, 3 aluguéis)','passa',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd63-0000-0000-0000-000000000002',3,current_date+90,current_date+149,2,6000,3000,'pendente_aceite')$q$);
select t('ATAQUE@0063','contrato-mãe de 181 dias','falha',$q$update contratos set prazo_total_dias=181 where id='dddddd63-0000-0000-0000-000000000002'$q$);

-- Ciclo: pendente que chegou na data sem aceite caduca; o sucessor pendente não "renova".
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal, prazo_total_dias) values
 ('dddddd63-0000-0000-0000-000000000003','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000,120);
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
 ('b6300000-0000-0000-0000-000000000021','dddddd63-0000-0000-0000-000000000003',1, current_date - 70, current_date - 11, 2, 6000, 3000, 'ativo'),
 ('b6300000-0000-0000-0000-000000000022','dddddd63-0000-0000-0000-000000000003',2, current_date - 10, current_date + 49, 2, 6000, 3000, 'pendente_aceite');
select public.avancar_ciclo_blocos();
select v('NOVO@0063','renovação sem os dois aceites caduca (não entra em vigor)','select status from contrato_blocos where id=''b6300000-0000-0000-0000-000000000022''','nao_aceito');
select v('NOVO@0063','bloco 1 encerra sem renovação','select status from contrato_blocos where id=''b6300000-0000-0000-0000-000000000021''','encerrado_sem_renovacao');
select v('NOVO@0063','contrato-mãe encerra sem renovação','select status from contratos where id=''dddddd63-0000-0000-0000-000000000003''','encerrado_sem_renovacao');

-- 3. selos: imóvel ativo sem qualificação ligada mantém os selos ao editar.
update public.properties set ready_to_live_score = 80, ready_to_live_badge = true, tag_home_office = true
 where id = 'aaaaaaa1-0000-0000-0000-000000000001';
delete from public.qualification_checklists where property_id = 'aaaaaaa1-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0063','dono edita o preço do anúncio ativo','passa',$q$update properties set monthly_price=3100 where id='aaaaaaa1-0000-0000-0000-000000000001'$q$);
reset role;
select v('NOVO@0063','…e os selos continuam (antes zeravam)','select ready_to_live_score::text || ''/'' || ready_to_live_badge::text || ''/'' || tag_home_office::text from properties where id=''aaaaaaa1-0000-0000-0000-000000000001''','80/true/true');

-- 4. Fundador: 20 vagas.
update public.profiles set fundador = false;
insert into auth.users (id, email, raw_user_meta_data)
select ('f0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'f' || g || '@t.com', '{"role":"owner","full_name":"F"}'
  from generate_series(1, 21) g;
update public.profiles set role = 'owner' where email like 'f%@t.com';
select t('NOVO@0063','admin marca 20 Fundadores','passa',$q$select count(public.marcar_fundador(('f0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid)) from generate_series(1, 20) g$q$);
select v('NOVO@0063','fundador_em carimbado','select count(*)::text from profiles where fundador and fundador_em is not null','20');
select t('ATAQUE@0063','21º Fundador','falha',$q$select public.marcar_fundador('f0000000-0000-0000-0000-000000000021')$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0063','proprietário se marca Fundador','falha',$q$select public.marcar_fundador('11111111-1111-1111-1111-111111111111')$q$);
reset role;
update public.profiles set fundador = false, fundador_em = null where email like 'f%@t.com';

-- 5. expiração no fim do dia, horário de Brasília.
insert into public.pedidos_moradia (id, inquilino_id, cidade, data_inicio, criado_em) values
 ('bbbbbb63-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Uberlândia','2026-11-01','2026-10-04 12:00:00+00');
select v('NOVO@0063','pedido de 01/11 expira 16/11 às 23:59:59 de Brasília','select to_char(expira_em at time zone ''America/Sao_Paulo'', ''YYYY-MM-DD HH24:MI:SS'') from pedidos_moradia where id=''bbbbbb63-0000-0000-0000-000000000001''','2026-11-16 23:59:59');
