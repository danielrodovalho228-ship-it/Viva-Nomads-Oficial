insert into properties(id,owner_id,status,photo_count) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000000f','draft',0);
-- fotos: protege_campos reverte photo_count -> precisamos de 8 fotos reais
update properties set photo_count=8 where id='00000000-0000-0000-0000-0000000000a1';
insert into properties(id,owner_id,status,photo_count) values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-00000000000f','draft',0);
update properties set photo_count=8 where id='00000000-0000-0000-0000-0000000000a2';
insert into qualification_checklists(property_id,owner_id,document_status) values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-00000000000f','approved');
select t('#49 service_role publica SEM documento','falha',$q$update properties set status='active' where id='00000000-0000-0000-0000-0000000000a1'$q$,'service_role');
select t('#49 admin publica SEM documento','falha',$q$update properties set status='active' where id='00000000-0000-0000-0000-0000000000a1'$q$,'authenticated','1');
select t('#49 service_role publica COM documento aprovado','passa',$q$update properties set status='active' where id='00000000-0000-0000-0000-0000000000a2'$q$,'service_role');
select t('#49 service_role INSERT ativo (semente do lab)','passa',$q$insert into properties(owner_id,status) values ('00000000-0000-0000-0000-00000000000f','active')$q$,'service_role');
select t('#49 postgres (dono do banco) publica','passa',$q$update properties set status='active' where id='00000000-0000-0000-0000-0000000000a1'$q$,'postgres');
update properties set status='draft' where id='00000000-0000-0000-0000-0000000000a1';
select t('#49 dono comum SEM documento (já valia)','falha',$q$update properties set status='active' where id='00000000-0000-0000-0000-0000000000a1'$q$,'authenticated');
-- #81: dono manda photo_count=8 junto com status=active, com documento aprovado e 0 fotos reais
insert into properties(id,owner_id,status,photo_count) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-00000000000f','draft',0);
insert into qualification_checklists(property_id,owner_id,document_status) values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-00000000000f','approved');
select t('#81 dono publica com photo_count=8 forjado (0 fotos reais)','falha',$q$update properties set status='active', photo_count=8 where id='00000000-0000-0000-0000-0000000000a3'$q$,'authenticated');
select t('#120 visitante com e-mail inválido','falha',$q$insert into chamados(visitante_email,visitante_nome) values ('isso nao e email','Ana')$q$,'service_role');
select t('#120 visitante com nome de 1 letra','falha',$q$insert into chamados(visitante_email,visitante_nome) values ('a@b.com','A')$q$,'service_role');
select t('#120 visitante sem nome','falha',$q$insert into chamados(visitante_email,visitante_nome) values ('a@b.com',null)$q$,'service_role');
select t('#120 visitante com nome de 61 letras','falha',$q$insert into chamados(visitante_email,visitante_nome) values ('a@b.com',repeat('x',61))$q$,'service_role');
select t('#120 visitante válido','passa',$q$insert into chamados(visitante_email,visitante_nome) values ('ana@exemplo.com.br','Ana Souza')$q$,'service_role');
select t('#120 usuário logado sem e-mail/nome','passa',$q$insert into chamados(usuario_id) values ('00000000-0000-0000-0000-00000000000f')$q$,'service_role');
select t('#120 chamado antigo sem dono continua editável','passa',$q$update chamados set visitante_nome=visitante_nome where visitante_email='ana@exemplo.com.br'$q$,'service_role');
select t('#26 tabela de backup foi apagada','falha',$q$select 1 from public._backup_p0_draft_data$q$,'postgres');
