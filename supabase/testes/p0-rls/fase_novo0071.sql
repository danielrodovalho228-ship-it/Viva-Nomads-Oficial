-- 0071 — financeiro: histórico, recebimentos e agregados só da equipe.
reset role;
select v('NOVO@0071','foto inicial: a assinatura antiga entrou no histórico','select count(*)::text from assinatura_eventos where origem=''inicio_historico'' and subscription_id=''5ab00000-0000-0000-0000-000000000001''','1');
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0071','anônimo chama admin_financeiro','falha',$q$select public.admin_financeiro(current_date - 29, current_date)$q$);
select t('ATAQUE@0071','anônimo lê recebimentos','falha',$q$select count(*) from recebimentos$q$);
select t('ATAQUE@0071','anônimo lê histórico de assinaturas','falha',$q$select count(*) from assinatura_eventos$q$);
reset role;
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0071','proprietário chama admin_financeiro','falha',$q$select public.admin_financeiro(current_date - 29, current_date)$q$);
select t('ATAQUE@0071','proprietário chama a função interna','falha',$q$select public.admin_assinaturas_em(now())$q$);
select t('ATAQUE@0071','proprietário grava histórico falso','falha',$q$insert into assinatura_eventos(subscription_id,status_para) values ('5ab00000-0000-0000-0000-000000000001','active')$q$);
select t('ATAQUE@0071','proprietário grava recebimento falso','falha',$q$insert into recebimentos(tipo,payment_id,valor,pago_em) values ('assinatura','x',1,now())$q$);
select t('ATAQUE@0071','proprietário chama o gatilho como RPC','falha',$q$select public.registra_assinatura_evento()$q$);
reset role;
-- Movimento do período (servidor, como o webhook faz).
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
insert into public.subscriptions (id, owner_id, plan, status) values ('5ab00000-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','essential','active');
update public.subscriptions set status = 'overdue' where id = '5ab00000-0000-0000-0000-000000000001';
update public.subscriptions set status = 'overdue' where id = '5ab00000-0000-0000-0000-000000000001'; -- repetido: não registra de novo
insert into public.recebimentos (tipo, payment_id, owner_id, plano, valor, pago_em) values ('assinatura','pay_71_a','55555555-5555-5555-5555-555555555555','essential',49,now());
select t('ATAQUE@0071','mesmo pagamento duas vezes','falha',$q$insert into recebimentos (tipo, payment_id, valor, pago_em) values ('assinatura','pay_71_a',49,now())$q$);
reset role;
select v('NOVO@0071','gatilho: 2 mudanças registradas (a repetida não conta)','select count(*)::text from assinatura_eventos where origem=''gatilho'' and subscription_id in (''5ab00000-0000-0000-0000-000000000001'',''5ab00000-0000-0000-0000-000000000002'')','2');
-- Contrato com comissão paga, e gasto de marketing do mês.
insert into public.properties (id, owner_id, title, city, status, monthly_price) values
 ('a7100000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Fin A','Cidade Setenta e Um','draft',4000);
insert into public.leads (id, owner_id, tenant_id, property_id, status) values
 ('17100000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','a7100000-0000-0000-0000-000000000001','accepted');
insert into public.contratos (id, property_id, tenant_id, aluguel_mensal, comissao_percent, comissao_valor, lead_id, owner_plan) values
 ('c7100000-0000-0000-0000-000000000001','a7100000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',4000,0.08,320,'17100000-0000-0000-0000-000000000001','pro');
insert into public.cobrancas_fechamento (lead_id, tipo, status, pago_em) values ('17100000-0000-0000-0000-000000000001','comissao','pago',now());
insert into public.recebimentos (tipo, payment_id, lead_id, valor, pago_em) values ('comissao','pay_71_c','17100000-0000-0000-0000-000000000001',320,now());
insert into public.gastos_marketing (mes, canal, valor) values (date_trunc('month', current_date)::date, 'instagram', 100);
set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0071','admin vê o financeiro','passa',$q$select public.admin_financeiro(current_date - 29, current_date)$q$);
select v('NOVO@0071','novas = 1 e saídas = 1 no período','select (x->''assinaturas''->>''novas'') || ''/'' || (x->''assinaturas''->>''saidas'') from (select public.admin_financeiro(current_date - 29, current_date) x) s','1/1');
select v('NOVO@0071','agora: 1 essencial ativa','select public.admin_financeiro(current_date - 29, current_date)->''assinaturas''->''agora''->>''essential''','1');
select v('NOVO@0071','início do período antes do histórico → null (tela mostra —)','select coalesce(public.admin_financeiro(current_date - 29, current_date)->''assinaturas''->>''inicio'', ''null'')','null');
select v('NOVO@0071','recebido: assinatura 49','select public.admin_financeiro(current_date - 29, current_date)->''recebido''->>''assinatura''','49.00');
select v('NOVO@0071','cidade: comissão recebida 320 e contrato listado como pago','select (x->''recebido''->>''comissao'') || ''/'' || (x->''comissoes''->0->>''status'') from (select public.admin_financeiro(current_date - 29, current_date, ''Cidade Setenta e Um'') x) s','320.00/pago');
select v('NOVO@0071','com cidade: assinaturas e marketing null (não têm cidade)','select coalesce(x->>''assinaturas'',''null'') || ''/'' || coalesce(x->>''marketing'',''null'') from (select public.admin_financeiro(current_date - 29, current_date, ''Cidade Setenta e Um'') x) s','null/null');
select v('NOVO@0071','marketing do mês: 100','select public.admin_financeiro(current_date - 29, current_date)->''marketing''->>''gasto''','100.00');
select v('NOVO@0071','série mensal com 12 meses','select jsonb_array_length(public.admin_financeiro(current_date - 29, current_date)->''mensal'')::text','12');
select v('NOVO@0071','churn 30d sem histórico de 30 dias → null','select coalesce(public.admin_financeiro(current_date - 29, current_date)->''assinaturas''->>''saidas_30d'', ''null'')','null');
select v('NOVO@0071','nada de NaN/Infinity','select (public.admin_financeiro(current_date - 364, current_date)::text !~* ''nan|infinity'')::text','true');
reset role;
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select t('NOVO@0071','servidor (cache) chama o financeiro','passa',$q$select public.admin_financeiro(current_date - 6, current_date)$q$);
reset role;
update public.subscriptions set status = 'canceled' where id::text like '5ab00000%';
delete from public.gastos_marketing where canal = 'instagram' and valor = 100;
