-- Antes da 0080: o Auth não consegue apagar dono com fotos (o bug).
reset role;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
grant usage on schema auth to supabase_auth_admin;
grant select, delete on auth.users to supabase_auth_admin;
insert into auth.users (id, email, raw_user_meta_data) values ('80808080-0000-0000-0000-000000000009','dono0080b@t.com','{"role":"owner","full_name":"Dono B"}');
insert into public.properties (id, owner_id, title, city, status, monthly_price) values ('80808080-0000-0000-0000-0000000000b9','80808080-0000-0000-0000-000000000009','Imóvel B','Uberlândia','draft',3000);
insert into public.property_photos (property_id, url) values ('80808080-0000-0000-0000-0000000000b9','f1.jpg');
set role supabase_auth_admin;
select t('ANTES@0080','Auth apaga dono com fotos','falha',$q$delete from auth.users where id='80808080-0000-0000-0000-000000000009'$q$);
reset role;
delete from auth.users where id='80808080-0000-0000-0000-000000000009';
