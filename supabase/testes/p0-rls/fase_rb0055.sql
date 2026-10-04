reset role;
select v('RB0055','uid_por_email_exato removida','select count(*)::text from pg_proc where proname=''uid_por_email_exato''','0');
select v('RB0055','tabela de pedidos removida','select count(*)::text from information_schema.tables where table_name=''exclusao_conta_pedidos''','0');
set role authenticated; select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select t('RB0055','política antiga de chamado volta (sem contrato)','passa',$q$insert into service_orders(property_id,tenant_id,owner_id,description) values ('aaaaaaa1-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','x')$q$);
reset role;
