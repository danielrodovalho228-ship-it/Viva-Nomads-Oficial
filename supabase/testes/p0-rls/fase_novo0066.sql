-- 0066 — coordenadas aproximadas no público.
reset role;
select v('NOVO@0066','backfill: o exato foi para lat_exata','select lat_exata::text from properties where id=''a6600000-0000-0000-0000-000000000001''','-18.918123');
select v('NOVO@0066','backfill: o público agora é aproximado (≠ exato, até ~600 m)','select (lat <> lat_exata and abs(lat - lat_exata) <= 0.0046 and abs(lng - lng_exata) <= 0.0046 / cos(radians(lat_exata)) + 0.0006)::text from properties where id=''a6600000-0000-0000-0000-000000000001''','true');

set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0066','anônimo lê lat_exata','falha',$q$select lat_exata from properties where id='a6600000-0000-0000-0000-000000000001'$q$);
select v('ATAQUE@0066','anônimo não vê mais o ponto exato em lat','select (lat::text <> ''-18.918123'')::text from properties where id=''a6600000-0000-0000-0000-000000000001''','true');
reset role;

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0066','dono cadastra imóvel com o ponto do geocode','passa',$q$insert into properties(id,owner_id,title,city,monthly_price,lat,lng) values ('a6600000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Novo','Uberlândia',2500,-18.900001,-48.270002)$q$);
select v('NOVO@0066','dono lê o exato pela RPC','select lat::text from property_coordenadas(''a6600000-0000-0000-0000-000000000002'')','-18.900001');
select t('NOVO@0066','dono edita o preço reenviando o lat público (editor)','passa',$q$update properties set monthly_price=2600, lat=lat, lng=lng where id='a6600000-0000-0000-0000-000000000002'$q$);
select t('NOVO@0066','dono edita sem coordenada (null)','passa',$q$update properties set monthly_price=2700, lat=null, lng=null where id='a6600000-0000-0000-0000-000000000002'$q$);
select v('NOVO@0066','…o exato continua o mesmo','select lat::text from property_coordenadas(''a6600000-0000-0000-0000-000000000002'')','-18.900001');
select t('ATAQUE@0066','dono tenta gravar lat_exata direto (sem mudar lat)','passa',$q$update properties set lat_exata=0, lng_exata=0 where id='a6600000-0000-0000-0000-000000000002'$q$);
select v('ATAQUE@0066','…sem efeito','select lat::text from property_coordenadas(''a6600000-0000-0000-0000-000000000002'')','-18.900001');
select t('NOVO@0066','novo geocode (endereço mudou)','passa',$q$update properties set lat=-18.910000, lng=-48.260000 where id='a6600000-0000-0000-0000-000000000002'$q$);
select v('NOVO@0066','…vira o novo exato','select lat::text from property_coordenadas(''a6600000-0000-0000-0000-000000000002'')','-18.91');
set role authenticated; select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select v('ATAQUE@0066','outra pessoa não lê o exato pela RPC','select count(*)::text from property_coordenadas(''a6600000-0000-0000-0000-000000000002'')','0');
reset role;
select v('NOVO@0066','ponto público é FIXO (mesma conta, mesmo resultado)','select (p.lat = ap.lat_ap)::text from properties p, coordenada_aproximada(p.id, p.lat_exata, p.lng_exata) ap where p.id=''a6600000-0000-0000-0000-000000000002''','true');
update public.properties set status = 'draft' where id::text like 'a6600000%';
