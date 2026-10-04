-- Antes da 0066: lat/lng exatos legíveis pelo público.
reset role;
insert into public.properties (id, owner_id, title, city, status, monthly_price, lat, lng) values
 ('a6600000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ativo com GPS','Uberlândia','active',3000,-18.918123,-48.257456);
set role anon; select set_config('request.jwt.claims','{}',false);
select v('ANTES@0066','anônimo lê o ponto EXATO do imóvel','select lat::text from properties where id=''a6600000-0000-0000-0000-000000000001''','-18.918123');
reset role;
