-- 0073 — chamados: cada um vê o seu; escrita só pelo servidor; admin vê tudo.
reset role;
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select t('NOVO@0073','servidor abre chamado do inquilino (B)','passa',$q$insert into chamados(id,usuario_id,tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao) values ('c7300000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','suporte','duvida','p3','site','Como funciona a caução?',now()+interval '1 day',now()+interval '3 days')$q$);
select t('NOVO@0073','servidor grava mensagem pública e nota interna','passa',$q$insert into chamado_mensagens(chamado_id,autor,corpo,interno) values ('c7300000-0000-0000-0000-000000000001','usuario','Como funciona a caução?',false),('c7300000-0000-0000-0000-000000000001','admin','nota só da equipe',true)$q$);
select t('NOVO@0073','servidor abre chamado de visitante (e-mail)','passa',$q$insert into chamados(id,visitante_email,tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao) values ('c7300000-0000-0000-0000-000000000002','visita@t.com','suporte','duvida','p3','email','Como anuncio?',now()+interval '1 day',now()+interval '3 days')$q$);
select t('ATAQUE@0073','chamado sem dono nem e-mail','falha',$q$insert into chamados(tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao) values ('suporte','duvida','p3','site','x',now(),now())$q$);
select t('ATAQUE@0073','prioridade inválida','falha',$q$insert into chamados(usuario_id,tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao) values ('22222222-2222-2222-2222-222222222222','suporte','duvida','p9','site','x',now(),now())$q$);
reset role;
select v('NOVO@0073','número público VN-000100…','select numero_publico ~ ''^VN-[0-9]{6}$'' from chamados where id=''c7300000-0000-0000-0000-000000000001''','true');

set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select v('NOVO@0073','inquilino vê o próprio chamado','select count(*)::text from chamados','1');
select v('NOVO@0073','…e só a mensagem pública (nota interna escondida)','select count(*)::text from chamado_mensagens','1');
select t('ATAQUE@0073','inquilino grava chamado direto pela API','falha',$q$insert into chamados(usuario_id,tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao) values ('22222222-2222-2222-2222-222222222222','suporte','duvida','p1','site','x',now(),now())$q$);
select t('ATAQUE@0073','inquilino muda a própria prioridade','falha',$q$update chamados set prioridade='p1' where id='c7300000-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0073','inquilino escreve mensagem direto','falha',$q$insert into chamado_mensagens(chamado_id,autor,corpo) values ('c7300000-0000-0000-0000-000000000001','admin','resposta falsa da equipe')$q$);
select t('ATAQUE@0073','inquilino lê a auditoria','passa',$q$select count(*) from chamado_eventos$q$);
select v('ATAQUE@0073','…e não vê nada dela','select count(*)::text from chamado_eventos','0');
select t('ATAQUE@0073','inquilino chama as métricas','falha',$q$select public.admin_atendimento_metricas(30)$q$);
reset role;

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select v('ATAQUE@0073','outra pessoa (A) não vê o chamado de B','select count(*)::text from chamados','0');
select v('ATAQUE@0073','…nem as mensagens','select count(*)::text from chamado_mensagens','0');
reset role;
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0073','anônimo lê chamados','falha',$q$select count(*) from chamados$q$);
reset role;

set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select v('NOVO@0073','admin vê todos (inclui visitante)','select count(*)::text from chamados where id::text like ''c7300000%''','2');
select v('NOVO@0073','admin vê a nota interna','select count(*)::text from chamado_mensagens where interno','1');
select t('NOVO@0073','admin lê as métricas','passa',$q$select public.admin_atendimento_metricas(30)$q$);
select t('ATAQUE@0073','admin também não grava pela API (só pelo servidor)','falha',$q$update chamados set status='encerrado' where id='c7300000-0000-0000-0000-000000000001'$q$);
reset role;

-- Varredura: chamado P1 vencido vira "estourado"; simulação não conta para alerta.
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
insert into chamados(id,usuario_id,tipo,categoria,prioridade,canal,assunto,prazo_primeira_resposta,prazo_resolucao,criado_em)
 values ('c7300000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','seguranca','seguranca','p1','site','Pix direto',now()-interval '5 minutes',now()+interval '1 hour',now()-interval '2 hours'),
        ('c7300000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','seguranca','seguranca','p1','site','Simulado',now()-interval '5 minutes',now()+interval '1 hour',now()-interval '2 hours');
update chamados set simulacao = true where id = 'c7300000-0000-0000-0000-000000000004';
select v('NOVO@0073','varredura: 1 P1 real pede alerta (simulação fora)','select public.atendimento_varrer_prazos()::text','1');
reset role;
select v('NOVO@0073','…marcado como estourado','select sla_estado from chamados where id=''c7300000-0000-0000-0000-000000000003''','estourado');
select v('NOVO@0073','métricas ignoram a simulação','select (public.admin_atendimento_metricas(30)->''por_prioridade''->>''p1'')','1');
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0073','inquilino roda a varredura','falha',$q$select public.atendimento_varrer_prazos()$q$);
reset role;
select v('NOVO@0073','bucket de anexos é privado','select (not public)::text from storage.buckets where id=''chamados''','true');
delete from public.chamados where id::text like 'c7300000%';
