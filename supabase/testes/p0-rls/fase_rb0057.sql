reset role;
select v('RB0057','máscara e bloqueios removidos','select count(*)::text from pg_proc where proname in (''mask_contact'',''contem_contato'',''bloqueia_contato_texto'',''primeiros_nomes'',''respostas_pedido_transicao'',''pagamentos_confirmacao'')','0');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('RB0057','regra antiga de assinatura volta (dono grava)','passa',$q$insert into subscriptions(owner_id,plan) values ('11111111-1111-1111-1111-111111111111','free')$q$);
reset role;
