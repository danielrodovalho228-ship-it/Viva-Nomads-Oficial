reset role; set role anon; select set_config('request.jwt.claims', '{}', false);
select t('RB0053','select * volta a funcionar','passa',$q$select * from properties where status='active'$q$);
reset role; set role authenticated; select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', false);
select t('RB0053','RPC pela sessão volta a funcionar','passa',$q$select * from owner_notify_contact('aaaaaaa1-0000-0000-0000-000000000001')$q$);
reset role;
select v('RB0053','draft limpo pela 0053 devolvido (P2)','select draft_data->>''street'' from properties where id=''aaaaaaa2-0000-0000-0000-000000000002''','Rua Rascunho 9');
