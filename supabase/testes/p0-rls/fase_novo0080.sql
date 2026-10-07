-- 0080 — apagar pelo Auth um dono com imóvel e fotos funciona (antes: permission denied).
reset role;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
grant usage on schema auth to supabase_auth_admin;
grant select, delete on auth.users to supabase_auth_admin;
insert into auth.users (id, email, raw_user_meta_data) values ('80808080-0000-0000-0000-000000000001','dono0080@t.com','{"role":"owner","full_name":"Dono 0080"}');
insert into public.properties (id, owner_id, title, city, status, monthly_price) values ('80808080-0000-0000-0000-0000000000a1','80808080-0000-0000-0000-000000000001','Imóvel 0080','Uberlândia','draft',3000);
insert into public.property_photos (property_id, url) values ('80808080-0000-0000-0000-0000000000a1','f1.jpg'), ('80808080-0000-0000-0000-0000000000a1','f2.jpg');
select v('NOVO@0080','gatilho conta as fotos','select photo_count::text from properties where id=''80808080-0000-0000-0000-0000000000a1''','2');
select v('NOVO@0080','funções das fotos rodam como dono do banco','select count(*)::text from pg_proc where proname in (''recalc_listing_quality'',''trg_recalc_listing_quality'') and prosecdef','2');
set role supabase_auth_admin;
select t('NOVO@0080','Auth apaga dono com imóvel e fotos (cascata)','passa',$q$delete from auth.users where id='80808080-0000-0000-0000-000000000001'$q$);
reset role;
select v('NOVO@0080','…e o imóvel e as fotos foram junto','select (select count(*) from properties where id=''80808080-0000-0000-0000-0000000000a1'') + (select count(*) from property_photos where property_id=''80808080-0000-0000-0000-0000000000a1'')','0');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0080','usuário logado chama recalc_listing_quality','falha',$q$select public.recalc_listing_quality('aaaaaaa1-0000-0000-0000-000000000001')$q$);
select t('NOVO@0080','dono continua enviando foto (gatilho funciona)','passa',$q$insert into property_photos(property_id,url) values ('aaaaaaa1-0000-0000-0000-000000000001','https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/g80.jpg')$q$);
reset role;
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0080','anônimo chama recalc_listing_quality','falha',$q$select public.recalc_listing_quality('aaaaaaa1-0000-0000-0000-000000000001')$q$);
reset role;
delete from property_photos where url like '%g80.jpg';
