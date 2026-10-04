-- 0057 — A6 (contratos/blocos/pagamentos/locações/assinatura), A1 (candidatura e
-- resposta a Pedido), A2 (contato no banco).
-- Dados de fases anteriores: lead ACEITO inquilino 2222 × dono 1111 no Ativo 1;
-- contratos dddd…01 (Ativo 1, ativo) e dddd…03 (Ativo Q, encerrado_em_acerto).
reset role;
insert into public.contrato_blocos (id, contrato_id, numero_bloco, valor, caucao) values
 ('b1000000-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',1,6000,3000),
 ('b3000000-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-000000000003',1,5000,2500);
update public.contratos set aluguel_mensal = 3000, comissao_percent = 0.12 where id = 'dddddddd-0000-0000-0000-000000000001';

-- ── A6 assinatura ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0057','dono se dá o plano Gestor','falha',$q$insert into subscriptions(owner_id,plan,status) values ('11111111-1111-1111-1111-111111111111','gestor','active')$q$);
select t('NOVO@0057','dono lê a própria assinatura','passa',$q$select plan from subscriptions where owner_id='11111111-1111-1111-1111-111111111111'$q$);

-- ── A6 contratos e blocos ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0057','inquilino cria contrato direto','falha',$q$insert into contratos(property_id,tenant_id,status) values ('aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo')$q$);
select t('ATAQUE@0057','inquilino cria bloco direto','falha',$q$insert into contrato_blocos(contrato_id,numero_bloco,valor) values ('dddddddd-0000-0000-0000-000000000001',2,1)$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0057','dono tenta mudar aluguel/comissão do contrato (sem efeito)','passa',$q$update contratos set aluguel_mensal=1, comissao_percent=0, tenant_id='33333333-3333-3333-3333-333333333333' where id='dddddddd-0000-0000-0000-000000000001'$q$);
select t('NOVO@0057','dono tenta comprovar caução do bloco (sem efeito)','passa',$q$update contrato_blocos set caucao_status='comprovada', valor=1 where id='b1000000-0000-0000-0000-000000000001'$q$);
reset role;
select v('ATAQUE@0057','contrato e bloco seguem intactos','select concat_ws(''/'',c.aluguel_mensal,c.comissao_percent,c.tenant_id,b.caucao_status,b.valor) from contratos c join contrato_blocos b on b.contrato_id=c.id where c.id=''dddddddd-0000-0000-0000-000000000001''','3000/0.12/22222222-2222-2222-2222-222222222222/pendente/6000');

-- ── A6 pagamentos ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0057','dono registra recebimento do bloco certo','passa',$q$insert into pagamentos_bloco(id,bloco_id,contrato_id,valor,data_pagamento,marcado_por) values ('a1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',3000,'2026-10-01','11111111-1111-1111-1111-111111111111')$q$);
select t('ATAQUE@0057','dono registra com bloco de OUTRO contrato','falha',$q$insert into pagamentos_bloco(bloco_id,contrato_id,valor,data_pagamento,marcado_por) values ('b3000000-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-000000000001',3000,'2026-10-01','11111111-1111-1111-1111-111111111111')$q$);
select t('ATAQUE@0057','dono registra já "confirmado pelo inquilino"','falha',$q$insert into pagamentos_bloco(bloco_id,contrato_id,valor,data_pagamento,marcado_por,confirmado_pelo_inquilino) values ('b1000000-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',3000,'2026-10-01','11111111-1111-1111-1111-111111111111',true)$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0057','inquilino altera o valor do pagamento','falha',$q$update pagamentos_bloco set valor=1 where id='a1000000-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0057','inquilino grava a data de confirmação','falha',$q$update pagamentos_bloco set confirmado_em='2020-01-01' where id='a1000000-0000-0000-0000-000000000001'$q$);
select t('NOVO@0057','inquilino confirma o pagamento','passa',$q$update pagamentos_bloco set confirmado_pelo_inquilino=true where id='a1000000-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0057','inquilino desfaz a confirmação','falha',$q$update pagamentos_bloco set confirmado_pelo_inquilino=false where id='a1000000-0000-0000-0000-000000000001'$q$);
reset role;
select v('NOVO@0057','confirmação carimbada pelo banco','select (confirmado_em is not null)::text from pagamentos_bloco where id=''a1000000-0000-0000-0000-000000000001''','true');

-- ── A6 locação ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('NOVO@0057','locação com candidatura aceita','passa',$q$insert into locacoes(property_id,tenant_id,valor_total) values ('aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',9000)$q$);
select t('ATAQUE@0057','locação sem candidatura aceita','falha',$q$insert into locacoes(property_id,tenant_id,valor_total) values ('aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222',1)$q$);

-- ── A1 candidatura ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0057','dono tenta trocar o inquilino/zerar a taxa (sem efeito)','passa',$q$update leads set tenant_id='33333333-3333-3333-3333-333333333333', accepted_commission_rate=0 where property_id='aaaaaaa1-0000-0000-0000-000000000001' and owner_id='11111111-1111-1111-1111-111111111111'$q$);
reset role;
select v('ATAQUE@0057','candidatura segue intacta','select tenant_id::text from leads where property_id=''aaaaaaa1-0000-0000-0000-000000000001'' and owner_id=''11111111-1111-1111-1111-111111111111'' and status=''accepted''','22222222-2222-2222-2222-222222222222');
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0057','inquilino cria lead já com taxa/plano','falha',$q$insert into leads(property_id,owner_id,tenant_id,status,accepted_plan,accepted_commission_rate) values ('aaaaaaa3-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','new','gestor',0)$q$);
select t('ATAQUE@0057','inquilino cria lead com contato liberado','falha',$q$insert into leads(property_id,owner_id,tenant_id,status,contact_unlocked) values ('aaaaaaa3-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','new',true)$q$);
select t('NOVO@0057','inquilino cria lead normal','passa',$q$insert into leads(property_id,owner_id,tenant_id,status) values ('aaaaaaa3-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','new')$q$);

-- ── A1 resposta a Pedido ──
reset role;
insert into public.respostas_pedido (id, pedido_id, proprietario_id, imovel_id, status)
values ('c5000000-0000-0000-0000-000000000005','bbbbbbb1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','enviada');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0057','dono troca o pedido da resposta','falha',$q$update respostas_pedido set pedido_id='bbbbbbb1-0000-0000-0000-000000000001' where id='c5000000-0000-0000-0000-000000000005'$q$);
select t('ATAQUE@0057','dono reescreve a mensagem','falha',$q$update respostas_pedido set mensagem='novo texto' where id='c5000000-0000-0000-0000-000000000005'$q$);
select t('ATAQUE@0057','dono marca a própria resposta como aceita','falha',$q$update respostas_pedido set status='aceita_para_conversa' where id='c5000000-0000-0000-0000-000000000005'$q$);
select t('NOVO@0057','dono marca como vista','passa',$q$update respostas_pedido set status='vista' where id='c5000000-0000-0000-0000-000000000005'$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('NOVO@0057','inquilino do pedido recusa com motivo','passa',$q$update respostas_pedido set status='recusada', recusa_motivo='já achei' where id='c5000000-0000-0000-0000-000000000005'$q$);
select t('ATAQUE@0057','inquilino volta a recusada para aceita','falha',$q$update respostas_pedido set status='aceita_para_conversa' where id='c5000000-0000-0000-0000-000000000005'$q$);

-- ── A1 primeiro nome ──
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select v('NOVO@0057','primeiros_nomes: só quem tem relação, só o 1º nome','select string_agg(primeiro_nome, '','' order by primeiro_nome) from primeiros_nomes(array[''22222222-2222-2222-2222-222222222222'',''44444444-4444-4444-4444-444444444444'',''33333333-3333-3333-3333-333333333333'']::uuid[])','Inq');
reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0057','anon não executa primeiros_nomes','falha',$q$select * from primeiros_nomes(array['22222222-2222-2222-2222-222222222222']::uuid[])$q$);

-- ── A2 máscara no banco (mesmos casos do contact-guard.test.ts) ──
reset role;
select v('A2@0057','telefone com DDD','select (mask_contact(''me chama no (34) 99999-0001 por favor'') !~ ''99999'')::text','true');
select v('A2@0057','telefone corrido','select (mask_contact(''meu número é 34999990001'') !~ ''34999990001'')::text','true');
select v('A2@0057','telefone com +55','select (mask_contact(''liga no +55 34 9 9999-0001'') !~ ''9999-0001'')::text','true');
select v('A2@0057','e-mail','select (mask_contact(''manda pra ana.silva+vn@gmail.com'') !~ ''@gmail.com'')::text','true');
select v('A2@0057','wa.me','select (mask_contact(''https://wa.me/5534999990001 me add'') !~ ''wa.me'')::text','true');
select v('A2@0057','t.me','select (mask_contact(''t.me/fulano'') !~ ''t.me'')::text','true');
select v('A2@0057','instagram por URL','select (mask_contact(''meu insta é instagram.com/maria.nomad'') !~ ''instagram.com'')::text','true');
select v('A2@0057','@handle','select (mask_contact(''me chama no insta @maria.silva'') !~ ''@maria'')::text','true');
select v('A2@0057','os 3 padrões juntos','select (mask_contact(''liga (34) 99999-0001, e-mail joao@teste.com ou me segue no insta @joao.nomad'') !~ ''(99999|joao@|@joao)'')::text','true');
select v('A2@0057','NÃO mascara CEP','select mask_contact(''o CEP é 38400-000'')','o CEP é 38400-000');
select v('A2@0057','NÃO mascara data','select mask_contact(''entrada em 02/07/2026'')','entrada em 02/07/2026');
select v('A2@0057','NÃO mascara valores','select mask_contact(''o aluguel é R$ 3.200 e a caução R$ 6.400'')','o aluguel é R$ 3.200 e a caução R$ 6.400');
select v('A2@0057','NÃO mascara número de prédio','select mask_contact(''o prédio tem 20 andares e fica no número 1520'')','o prédio tem 20 andares e fica no número 1520');
select v('A2@0057','máscara é idempotente','select (mask_contact(mask_contact(''tel (34) 99999-0001'')) = mask_contact(''tel (34) 99999-0001''))::text','true');
select v('A2@0057','contem_contato: zap (Pedidos)','select contem_contato(''me chama no zap'')::text','true');
select v('A2@0057','contem_contato: telefone 8+ dígitos (Pedidos)','select contem_contato(''34 99999 8888'')::text','true');
select v('A2@0057','contem_contato: instalação NÃO','select contem_contato(''preciso de imóvel com boa instalação elétrica'')::text','false');
select v('A2@0057','contem_contato: faceta/instante NÃO','select (contem_contato(''gosto da faceta do apê'') or contem_contato(''instante de mudança''))::text','false');
select v('A2@0057','contem_contato: anúncio "face norte, CEP" NÃO','select contem_contato(''Apartamento face norte, CEP 38400-000'', false)::text','false');
select v('A2@0057','contem_contato: anúncio com celular SIM','select contem_contato(''ligue 34 99999-0001'', false)::text','true');

set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('NOVO@0057','mensagem com telefone é aceita…','passa',$q$insert into messages(id,conversation_id,sender_id,receiver_id,property_id,body) values ('e7000000-0000-0000-0000-000000000007','cccccccc-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','me chama no (34) 99999-0001')$q$);
reset role;
select v('A2@0057','… mas gravada MASCARADA (mesmo direto pela API)','select (body !~ ''99999'' and body ~ ''contato protegido'')::text from messages where id=''e7000000-0000-0000-0000-000000000007''','true');
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0057','pedido de moradia com "me chama no zap"','falha',$q$update pedidos_moradia set apresentacao='me chama no zap' where id='bbbbbbb1-0000-0000-0000-000000000001'$q$);
select t('NOVO@0057','pedido de moradia com texto normal','passa',$q$update pedidos_moradia set apresentacao='Sou médica, começo residência em março.' where id='bbbbbbb1-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0057','nome do perfil com telefone','falha',$q$update profiles set full_name='34999990001 Ana' where id='22222222-2222-2222-2222-222222222222'$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0057','anúncio com celular na descrição','falha',$q$update properties set description='ligue 34 99999-0001' where id='aaaaaaa1-0000-0000-0000-000000000001'$q$);
select t('NOVO@0057','anúncio "face norte, CEP 38400-000"','passa',$q$update properties set description='Apartamento face norte, CEP 38400-000' where id='aaaaaaa1-0000-0000-0000-000000000001'$q$);
reset role;
