-- 0076 — garantia única: contrato com seguro-fiança não tem caução.
reset role;
select v('NOVO@0076','contratos existentes ficam como caução','select count(*)::text from contratos where garantia is distinct from ''caucao''','0');
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal, prazo_total_dias, garantia) values
 ('dddddd76-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000,120,'seguro_fianca'),
 ('dddddd76-0000-0000-0000-000000000002','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000,120,'caucao');
select t('ATAQUE@0076','garantia fora da lista','falha',$q$update contratos set garantia='fiador' where id='dddddd76-0000-0000-0000-000000000002'$q$);
select t('NOVO@0076','fiança: bloco com caução zero','passa',$q$insert into contrato_blocos(id,contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('b7600000-0000-0000-0000-000000000001','dddddd76-0000-0000-0000-000000000001',1,current_date,current_date+59,2,6000,0,'ativo')$q$);
select t('ATAQUE@0076','fiança: bloco COM caução (duas garantias)','falha',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd76-0000-0000-0000-000000000001',2,current_date+60,current_date+119,2,6000,3000,'pendente_aceite')$q$);
select t('ATAQUE@0076','fiança: bloco ganha caução depois','falha',$q$update contrato_blocos set caucao=100 where id='b7600000-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0076','fiança: pagamento do tipo caução','falha',$q$insert into pagamentos_bloco(bloco_id,contrato_id,tipo,valor,data_pagamento,marcado_por) values ('b7600000-0000-0000-0000-000000000001','dddddd76-0000-0000-0000-000000000001','caucao',3000,current_date,'11111111-1111-1111-1111-111111111111')$q$);
select t('NOVO@0076','fiança: pagamento de aluguel continua normal','passa',$q$insert into pagamentos_bloco(bloco_id,contrato_id,tipo,valor,data_pagamento,marcado_por) values ('b7600000-0000-0000-0000-000000000001','dddddd76-0000-0000-0000-000000000001','aluguel',3000,current_date,'11111111-1111-1111-1111-111111111111')$q$);
select t('NOVO@0076','caução: bloco com caução dentro do teto','passa',$q$insert into contrato_blocos(id,contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('b7600000-0000-0000-0000-000000000002','dddddd76-0000-0000-0000-000000000002',1,current_date,current_date+59,2,6000,3000,'ativo')$q$);
select t('ATAQUE@0076','contrato com caução vira seguro-fiança','falha',$q$update contratos set garantia='seguro_fianca' where id='dddddd76-0000-0000-0000-000000000002'$q$);
select t('ATAQUE@0076','teto de 3 aluguéis continua valendo','falha',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd76-0000-0000-0000-000000000002',2,current_date+60,current_date+119,2,6000,6001,'pendente_aceite')$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
do $$ begin update contratos set garantia='caucao' where id='dddddd76-0000-0000-0000-000000000001'; exception when others then null; end $$;
reset role;
select v('ATAQUE@0076','inquilino não troca a garantia pela API (continua seguro-fiança)','select garantia from contratos where id=''dddddd76-0000-0000-0000-000000000001''','seguro_fianca');
delete from pagamentos_bloco where contrato_id::text like 'dddddd76%';
delete from contrato_blocos where contrato_id::text like 'dddddd76%';
delete from contratos where id::text like 'dddddd76%';
