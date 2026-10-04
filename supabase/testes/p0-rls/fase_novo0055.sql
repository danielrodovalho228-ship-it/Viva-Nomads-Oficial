-- 0055 — F1 (documents, service_orders) e M1 (e-mail exato, pedidos de exclusão).
reset role;
insert into public.contratos (id, property_id, tenant_id, status) values
 ('dddddddd-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo'),
 ('dddddddd-0000-0000-0000-000000000003','aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','concluido');

-- service_orders: só com contrato ativo/encerrado_em_acerto e dono real.
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('NOVO@0055','chamado com contrato ATIVO e dono real','passa',$q$insert into service_orders(id,property_id,tenant_id,owner_id,description) values ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','pia vazando')$q$);
select t('ATAQUE@0055','chamado informando dono FALSO','falha',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','x')$q$);
select t('ATAQUE@0055','chamado com contrato CONCLUÍDO','falha',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','x')$q$);
select t('ATAQUE@0055','chamado em nome de outro inquilino','falha',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa1-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','x')$q$);
reset role; update public.contratos set status='encerrado_em_acerto' where id='dddddddd-0000-0000-0000-000000000003';
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('NOVO@0055','chamado na SAÍDA (encerrado_em_acerto)','passa',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','avaria na saída')$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select t('ATAQUE@0055','chamado SEM contrato (estranho)','falha',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa1-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','x')$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0055','dono atualiza status do chamado','passa',$q$update service_orders set status='visto' where id='eeeeeeee-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0055','dono move chamado para imóvel de OUTRO dono','falha',$q$update service_orders set property_id='aaaaaaa3-0000-0000-0000-000000000003' where id='eeeeeeee-0000-0000-0000-000000000001'$q$);

-- documents: property_id nulo ou do próprio dono.
select t('NOVO@0055','orçamento do PRÓPRIO imóvel','passa',$q$insert into documents(id,doc_number,property_id,owner_id,tenant_name) values ('ffffffff-0000-0000-0000-000000000001','ORC-1','aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ana')$q$);
select t('NOVO@0055','orçamento sem imóvel','passa',$q$insert into documents(doc_number,owner_id,tenant_name) values ('ORC-2','11111111-1111-1111-1111-111111111111','Ana')$q$);
select t('ATAQUE@0055','orçamento de imóvel ALHEIO','falha',$q$insert into documents(doc_number,property_id,owner_id,tenant_id,tenant_name) values ('ORC-3','aaaaaaa3-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Inq')$q$);
select t('ATAQUE@0055','troca o imóvel do orçamento para um ALHEIO','falha',$q$update documents set property_id='aaaaaaa3-0000-0000-0000-000000000003' where id='ffffffff-0000-0000-0000-000000000001'$q$);

-- M1: e-mail exato, só service_role.
reset role; set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select v('NOVO@0055','e-mail exato (maiúsculas/espaços) acha a conta','select uid_por_email_exato(''  DONO@t.com '')::text','11111111-1111-1111-1111-111111111111');
select v('ATAQUE@0055','"_" não é coringa (d_no@t.com)','select coalesce(uid_por_email_exato(''d_no@t.com'')::text,''(nulo)'')','(nulo)');
select v('ATAQUE@0055','"%" não é coringa (%@t.com)','select coalesce(uid_por_email_exato(''%@t.com'')::text,''(nulo)'')','(nulo)');
select t('NOVO@0055','servidor registra pedido de exclusão','passa',$q$insert into exclusao_conta_pedidos(uid,email_hash,ip_hash) values ('11111111-1111-1111-1111-111111111111','h','i')$q$);
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0055','usuário não executa uid_por_email_exato','falha',$q$select uid_por_email_exato('dono@t.com')$q$);
select t('ATAQUE@0055','usuário não lê pedidos de exclusão','falha',$q$select * from exclusao_conta_pedidos$q$);
reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0055','anon não executa uid_por_email_exato','falha',$q$select uid_por_email_exato('dono@t.com')$q$);
reset role;
