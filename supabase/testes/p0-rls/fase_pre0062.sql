-- Antes da 0062: conta comum apaga o próprio perfil e o recria como admin.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
 ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','{"role":"tenant","full_name":"Atacante"}');
set role authenticated; select set_config('request.jwt.claims','{"sub":"c0ffee00-0000-0000-0000-000000000062"}',false);
select t('ANTES@0062','conta comum apaga o próprio perfil','passa',$q$delete from profiles where id='c0ffee00-0000-0000-0000-000000000062'$q$);
select t('ANTES@0062','…e recria como ADMIN','passa',$q$insert into profiles(id,email,role) values ('c0ffee00-0000-0000-0000-000000000062','atacante@t.com','admin')$q$);
select v('ANTES@0062','…e vira admin de verdade','select public.is_admin()::text','true');
reset role;
update profiles set role='tenant' where id='c0ffee00-0000-0000-0000-000000000062';
