-- 0062 — perfil não é criado nem apagado pelo cliente do usuário.
set role authenticated; select set_config('request.jwt.claims','{"sub":"c0ffee00-0000-0000-0000-000000000062"}',false);
select t('ATAQUE@0062','conta comum apaga o próprio perfil','falha',$q$delete from profiles where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select t('ATAQUE@0062','conta comum cria perfil admin para si','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','admin')$q$);
select t('ATAQUE@0062','upsert do perfil como admin','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','a@t.com','admin') on conflict (id) do update set role='admin'$q$);
select t('NOVO@0062','editar o próprio nome continua','passa',$q$update profiles set full_name='Atacante Silva' where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select v('ATAQUE@0062','continua não-admin','select public.is_admin()::text','false');
reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0062','anônimo cria perfil','falha',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000063','x@t.com','admin')$q$);
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
 ('c0ffee00-0000-0000-0000-000000000064','novo@t.com','{"role":"owner","full_name":"Novo"}');
select v('NOVO@0062','cadastro novo (trigger handle_new_user) ainda cria o perfil','select role from profiles where id=''c0ffee00-0000-0000-0000-000000000064''','owner');
