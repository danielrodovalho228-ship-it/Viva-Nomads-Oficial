-- 0075 — prazo depois da 1ª resposta (VN-000100): respondido no prazo sai de "em risco".
reset role;
insert into chamados(id,usuario_id,tipo,categoria,prioridade,canal,assunto,criado_em,prazo_primeira_resposta,prazo_resolucao,primeira_resposta_em,status,sla_estado) values
 ('c7500000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','suporte','duvida','p2','site','respondido no prazo', now()-interval '20 hours', now()-interval '30 minutes', now()+interval '28 hours', now()-interval '1 hour','aguardando_aprovacao','em_risco'),
 ('c7500000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','suporte','duvida','p2','site','respondido atrasado',  now()-interval '20 hours', now()-interval '2 hours',    now()+interval '28 hours', now()-interval '1 hour','aguardando_usuario','em_risco'),
 ('c7500000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','suporte','duvida','p2','site','resolução vencendo',   now()-interval '40 hours', now()-interval '30 hours',   now()+interval '4 hours',  now()-interval '35 hours','em_andamento','ok'),
 ('c7500000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','suporte','duvida','p2','site','resolução vencida',    now()-interval '50 hours', now()-interval '40 hours',   now()-interval '1 hour',   now()-interval '45 hours','em_andamento','ok'),
 ('c7500000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','suporte','duvida','p2','site','sem resposta, vencido', now()-interval '20 hours', now()-interval '1 hour',     now()+interval '28 hours', null,'aberto','ok');
insert into chamados(id,usuario_id,tipo,categoria,prioridade,canal,assunto,criado_em,prazo_primeira_resposta,prazo_resolucao,primeira_resposta_em,resolvido_em,status,sla_estado) values
 ('c7500000-0000-0000-0000-000000000006','22222222-2222-2222-2222-222222222222','suporte','duvida','p3','site','resolvido no prazo, preso em risco', now()-interval '20 hours', now()-interval '10 hours', now()+interval '28 hours', now()-interval '15 hours', now()-interval '2 hours','resolvido','em_risco');
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select t('NOVO@0075','varredura roda','passa',$q$select public.atendimento_varrer_prazos()$q$);
reset role;
select v('NOVO@0075','respondido no prazo (como o VN-000100): em risco → ok','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000001''','ok');
select v('NOVO@0075','1ª resposta atrasada fica estourado','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000002''','estourado');
select v('NOVO@0075','prazo de resolução ≥ 75% → em risco','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000003''','em_risco');
select v('NOVO@0075','prazo de resolução vencido → estourado','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000004''','estourado');
select v('NOVO@0075','sem resposta continua no relógio da 1ª resposta','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000005''','estourado');
select v('NOVO@0075','resolvido no prazo e preso em risco → ok','select sla_estado from chamados where id=''c7500000-0000-0000-0000-000000000006''','ok');
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0075','usuário chama a função de cálculo','falha',$q$select public.atendimento_sla_calculado(c) from chamados c limit 1$q$);
select t('ATAQUE@0075','usuário chama a varredura','falha',$q$select public.atendimento_varrer_prazos()$q$);
reset role;
delete from chamados where id::text like 'c7500000%';
