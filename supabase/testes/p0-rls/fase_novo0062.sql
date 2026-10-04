-- 0062 — segurança P0.
-- 1. profiles
set role authenticated; select set_config('request.jwt.claims','{"sub":"c0ffee00-0000-0000-0000-000000000062"}',false);
select t('ATAQUE@0062','conta comum apaga o próprio perfil','falha',$q$delete from profiles where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select t('ATAQUE@0062','conta comum cria perfil admin para si','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','admin')$q$);
select t('ATAQUE@0062','upsert do perfil como admin','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','a@t.com','admin') on conflict (id) do update set role='admin'$q$);
select t('NOVO@0062','editar o próprio nome continua','passa',$q$update profiles set full_name='Atacante Silva' where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select v('NOVO@0062','lê o próprio perfil','select full_name from profiles where id=''c0ffee00-0000-0000-0000-000000000062''','Atacante Silva');
select v('ATAQUE@0062','continua não-admin','select public.is_admin()::text','false');
reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0062','anônimo cria perfil','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000063','x@t.com','admin')$q$);
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
 ('c0ffee00-0000-0000-0000-000000000064','novo@t.com','{"role":"owner","full_name":"Novo"}');
select v('NOVO@0062','cadastro (handle_new_user) ainda cria o perfil','select role from profiles where id=''c0ffee00-0000-0000-0000-000000000064''','owner');
-- Cinto extra: mesmo com INSERT concedido por engano, ninguém nasce admin.
delete from profiles where id='c0ffee00-0000-0000-0000-000000000064';
grant insert on public.profiles to authenticated;
create policy "teste insere" on public.profiles for insert with check (auth.uid() = id);
set role authenticated; select set_config('request.jwt.claims','{"sub":"c0ffee00-0000-0000-0000-000000000064"}',false);
select t('NOVO@0062','(insert concedido por engano) grava','passa',$q$insert into profiles(id,email,role,verification_progress) values ('c0ffee00-0000-0000-0000-000000000064','novo@t.com','admin',100)$q$);
reset role; revoke insert on public.profiles from authenticated; drop policy "teste insere" on public.profiles;
select v('ATAQUE@0062','…mas nasce tenant, sem progresso de verificação','select role || ''/'' || verification_progress from profiles where id=''c0ffee00-0000-0000-0000-000000000064''','tenant/0');

-- 2. respostas_pedido
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('NOVO@0062','dono responde pedido ativo com imóvel ativo','passa',$q$insert into respostas_pedido(pedido_id,proprietario_id,imovel_id) values ('bbbbbbb9-0000-0000-0000-000000000009','55555555-5555-5555-5555-555555555555','aaaaaaa3-0000-0000-0000-000000000003')$q$);
select t('ATAQUE@0062','dono responde pedido removido pela moderação','falha',$q$insert into respostas_pedido(pedido_id,proprietario_id,imovel_id) values ('bbbbbbb8-0000-0000-0000-000000000008','55555555-5555-5555-5555-555555555555','aaaaaaa3-0000-0000-0000-000000000003')$q$);
select v('ATAQUE@0062','dono continua sem ler o pedido em si','select count(*)::text from pedidos_moradia where id=''bbbbbbb9-0000-0000-0000-000000000009''','0');

-- 3. avaliações
select t('ATAQUE@0062','dono cria 5★ no próprio imóvel','falha',$q$insert into property_reviews(property_id,author_name,rating) values ('aaaaaaa3-0000-0000-0000-000000000003','Fã',5)$q$);
select t('ATAQUE@0062','dono se autoavalia (cliente)','falha',$q$insert into avaliacoes(autor_id,alvo_id,rating) values ('55555555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555',5)$q$);
reset role;
select t('ATAQUE@0062','servidor: avaliação sem contrato','falha',$q$insert into avaliacoes(autor_id,alvo_id,rating) values ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222',5)$q$);
select t('ATAQUE@0062','servidor: autor = alvo','falha',$q$insert into avaliacoes(contrato_id,autor_id,alvo_id,rating) values ('dddddd62-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555',5)$q$);
select t('ATAQUE@0062','servidor: contrato ainda ativo','falha',$q$insert into avaliacoes(contrato_id,autor_id,alvo_id,rating) values ('dddddd62-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',5)$q$);
select t('ATAQUE@0062','servidor: estranho ao contrato','falha',$q$insert into avaliacoes(contrato_id,autor_id,alvo_id,rating) values ('dddddd62-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',1)$q$);
select t('NOVO@0062','servidor: inquilino avalia o dono após contrato concluído','passa',$q$insert into avaliacoes(contrato_id,autor_id,alvo_id,rating) values ('dddddd62-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',5)$q$);

-- 4. avatar_url só pelo servidor
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ATAQUE@0062','usuário grava avatar_url de outra pessoa','falha',$q$update profiles set avatar_url='22222222-2222-2222-2222-222222222222/avatar.webp' where id='55555555-5555-5555-5555-555555555555'$q$);

-- 5. moderação de pedido
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0062','inquilino tira o pedido da moderação','falha',$q$update pedidos_moradia set status='ativo' where id='bbbbbbb8-0000-0000-0000-000000000008'$q$);
select t('ATAQUE@0062','inquilino marca o próprio pedido como removido_admin','falha',$q$update pedidos_moradia set status='removido_admin' where id='bbbbbbb9-0000-0000-0000-000000000009'$q$);
select t('NOVO@0062','inquilino pausa o pedido ativo','passa',$q$update pedidos_moradia set status='pausado' where id='bbbbbbb9-0000-0000-0000-000000000009'$q$);
select t('NOVO@0062','…e reativa','passa',$q$update pedidos_moradia set status='ativo' where id='bbbbbbb9-0000-0000-0000-000000000009'$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0062','admin reativa o pedido removido','passa',$q$update pedidos_moradia set status='ativo' where id='bbbbbbb8-0000-0000-0000-000000000008'$q$);

-- 6. email_existe
reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0062','anônimo enumera e-mails','falha',$q$select public.email_existe('dono@t.com')$q$);
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0062','logado enumera e-mails','falha',$q$select public.email_existe('dono@t.com')$q$);
reset role; set role service_role;
select v('NOVO@0062','servidor consulta (rota com limite)','select public.email_existe(''dono@t.com'')::text','true');
reset role;

-- 8. vistorias
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ATAQUE@0062','parte muda o status da vistoria pelo cliente','falha',$q$update vistorias set status='assinada' where id='ffffff62-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0062','parte grava selada_em pelo cliente','falha',$q$update vistorias set selada_em=now() where id='ffffff62-0000-0000-0000-000000000001'$q$);
select t('NOVO@0062','parte edita rascunho (campo livre)','passa',$q$update vistorias set auto_checklist=true where id='ffffff62-0000-0000-0000-000000000001'$q$);
select t('NOVO@0062','parte cria vistoria em rascunho','passa',$q$insert into vistorias(contrato_id,tipo,executor_id) values ('dddddd62-0000-0000-0000-000000000002','saida','55555555-5555-5555-5555-555555555555')$q$);
select t('ATAQUE@0062','parte cria vistoria já assinada','falha',$q$insert into vistorias(contrato_id,tipo,executor_id,status) values ('dddddd62-0000-0000-0000-000000000002','saida','55555555-5555-5555-5555-555555555555','assinada')$q$);
select t('NOVO@0062','parte adiciona item no rascunho','passa',$q$insert into vistoria_itens(vistoria_id,comodo,item) values ('ffffff62-0000-0000-0000-000000000001','Sala','Sofá')$q$);
reset role; update vistorias set status='assinada', selada_em=now() where id='ffffff62-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ATAQUE@0062','apagar vistoria selada','falha',$q$delete from vistorias where id='ffffff62-0000-0000-0000-000000000001'$q$);
reset role;
select v('ATAQUE@0062','…a vistoria selada continua lá','select status from vistorias where id=''ffffff62-0000-0000-0000-000000000001''','assinada');
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ATAQUE@0062','apagar item de vistoria selada','falha',$q$delete from vistoria_itens where vistoria_id='ffffff62-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0062','incluir item em vistoria selada','falha',$q$insert into vistoria_itens(vistoria_id,comodo,item) values ('ffffff62-0000-0000-0000-000000000001','Sala','TV')$q$);

-- 9. leads
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0062','inquilino lê o motivo da recusa','falha',$q$select reject_reason from leads where id='eeeeee62-0000-0000-0000-000000000001'$q$);
select v('NOVO@0062','inquilino vê o status da candidatura','select status from leads where id=''eeeeee62-0000-0000-0000-000000000001''','rejected');
set role authenticated; select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select t('NOVO@0062','inquilino ainda cria candidatura','passa',$q$insert into leads(property_id,owner_id,tenant_id,status) values ('aaaaaaa3-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','new')$q$);
reset role;

-- 10. avatars
select v('NOVO@0062','política de UPDATE do avatar existe','select count(*)::text from pg_policies where tablename=''objects'' and policyname=''avatars: dono troca''','1');
