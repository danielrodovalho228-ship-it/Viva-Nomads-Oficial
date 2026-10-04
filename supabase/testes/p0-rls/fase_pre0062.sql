-- Antes da 0062 (estado de produção): as brechas da auditoria passam.
reset role;
-- email_existe (0031) como em produção.
create or replace function public.email_existe(e text) returns boolean
language sql security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(e)));
$$;
revoke all on function public.email_existe(text) from public;
grant execute on function public.email_existe(text) to anon, authenticated;
-- leads com grant de tabela inteira (como em produção).
grant select on public.leads to anon, authenticated;
-- Cenário: pedido ativo, imóvel ativo do dono2, contrato encerrado entre eles.
update public.properties set status = 'active' where id = 'aaaaaaa3-0000-0000-0000-000000000003';
insert into public.pedidos_moradia (id, inquilino_id, cidade, status) values
 ('bbbbbbb9-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','Uberlândia','ativo'),
 ('bbbbbbb8-0000-0000-0000-000000000008','22222222-2222-2222-2222-222222222222','Uberlândia','removido_admin');
insert into public.contratos (id, property_id, tenant_id, status) values
 ('dddddd62-0000-0000-0000-000000000001','aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','concluido'),
 ('dddddd62-0000-0000-0000-000000000002','aaaaaaa3-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','ativo');
delete from public.leads where property_id='aaaaaaa3-0000-0000-0000-000000000003' and tenant_id in ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
insert into public.leads (id, owner_id, tenant_id, property_id, status, reject_reason) values
 ('eeeeee62-0000-0000-0000-000000000001','55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','aaaaaaa3-0000-0000-0000-000000000003','rejected','renda baixa');
insert into auth.users (id, email, raw_user_meta_data) values
 ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','{"role":"tenant","full_name":"Atacante"}');

set role authenticated; select set_config('request.jwt.claims','{"sub":"c0ffee00-0000-0000-0000-000000000062"}',false);
select t('ANTES@0062','conta comum apaga o próprio perfil','passa',$q$delete from profiles where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select t('ANTES@0062','…e recria como ADMIN','passa',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','admin')$q$);
select v('ANTES@0062','…e vira admin de verdade','select public.is_admin()::text','true');
reset role; update profiles set role='tenant' where id='c0ffee00-0000-0000-0000-000000000062';

set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ANTES@0062','dono NÃO consegue responder pedido ativo','falha',$q$insert into respostas_pedido(pedido_id,proprietario_id,imovel_id) values ('bbbbbbb9-0000-0000-0000-000000000009','55555555-5555-5555-5555-555555555555','aaaaaaa3-0000-0000-0000-000000000003')$q$);
select t('ANTES@0062','dono cria 5★ no próprio imóvel','passa',$q$insert into property_reviews(property_id,author_name,rating) values ('aaaaaaa3-0000-0000-0000-000000000003','Fã',5)$q$);
select t('ANTES@0062','dono se autoavalia sem contrato','passa',$q$insert into avaliacoes(autor_id,alvo_id,rating) values ('55555555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555',5)$q$);
select t('ANTES@0062','usuário grava avatar_url de outra pessoa','passa',$q$update profiles set avatar_url='22222222-2222-2222-2222-222222222222/avatar.webp' where id='55555555-5555-5555-5555-555555555555'$q$);
reset role;
delete from property_reviews where author_name = 'Fã';
delete from avaliacoes where contrato_id is null;
update profiles set avatar_url = null where id='55555555-5555-5555-5555-555555555555';

set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ANTES@0062','inquilino tira o pedido da moderação','passa',$q$update pedidos_moradia set status='ativo' where id='bbbbbbb8-0000-0000-0000-000000000008'$q$);
select v('ANTES@0062','inquilino lê o motivo da recusa','select reject_reason from leads where id=''eeeeee62-0000-0000-0000-000000000001''','renda baixa');
reset role; update pedidos_moradia set status='removido_admin' where id='bbbbbbb8-0000-0000-0000-000000000008';
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ANTES@0062','anônimo enumera e-mails (email_existe)','passa',$q$select public.email_existe('dono@t.com')$q$);
reset role;
insert into public.vistorias (id, contrato_id, tipo, executor_id) values
 ('ffffff62-0000-0000-0000-000000000001','dddddd62-0000-0000-0000-000000000002','entrada','55555555-5555-5555-5555-555555555555');
set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select t('ANTES@0062','parte "sela" a vistoria pelo cliente','passa',$q$update vistorias set status='aguardando_confirmacao' where id='ffffff62-0000-0000-0000-000000000001'$q$);
reset role; update vistorias set status='rascunho' where id='ffffff62-0000-0000-0000-000000000001';
