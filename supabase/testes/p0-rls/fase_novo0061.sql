-- 0061 — qualificação grava a internet; fotos gravam/leem; rascunho ganha as fotos.
reset role;
select v('NOVO@0061','backfill: rascunho 4 ganhou as 8 fotos da pasta do dono (não a de fora)','select photo_count::text from properties where id=''aaaaaaa4-0000-0000-0000-000000000004''','8');
select v('NOVO@0061','backfill: capa = 1ª foto do editor','select url from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004'' and sort_order=0','https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/1.jpg');

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0061','qualificação com internet_tier grava','passa',$q$insert into qualification_checklists(owner_id,internet_tier) values ('11111111-1111-1111-1111-111111111111','home_office')$q$);
select t('ATAQUE@0061','internet_tier fora da lista','falha',$q$insert into qualification_checklists(owner_id,internet_tier) values ('11111111-1111-1111-1111-111111111111','gigabit')$q$);
select t('NOVO@0061','dono grava foto da PRÓPRIA pasta','passa',$q$insert into property_photos(property_id,url) values ('aaaaaaa2-0000-0000-0000-000000000002','https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/a.jpg')$q$);
select t('ATAQUE@0061','dono grava foto de OUTRA pasta/site','falha',$q$insert into property_photos(property_id,url) values ('aaaaaaa2-0000-0000-0000-000000000002','https://evil.example/x.jpg')$q$);
select t('ATAQUE@0061','dono grava foto no imóvel de OUTRO dono','falha',$q$insert into property_photos(property_id,url) values ('aaaaaaa3-0000-0000-0000-000000000003','https://x.supabase.co/storage/v1/object/public/property-photos/11111111-1111-1111-1111-111111111111/a.jpg')$q$);
select v('NOVO@0061','dono lê as fotos do PRÓPRIO rascunho','select count(*)::text from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004''','8');
select t('NOVO@0061','dono apaga e regrava fotos (resync)','passa',$q$delete from property_photos where property_id='aaaaaaa2-0000-0000-0000-000000000002'$q$);
select t('NOVO@0061','dono grava espaço de trabalho do próprio imóvel','passa',$q$insert into property_workspaces(property_id,name) values ('aaaaaaa2-0000-0000-0000-000000000002','Cowork X')$q$);

set role authenticated; select set_config('request.jwt.claims','{"sub":"55555555-5555-5555-5555-555555555555"}',false);
select v('ATAQUE@0061','outro dono não vê fotos do rascunho alheio','select count(*)::text from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004''','0');
select t('ATAQUE@0061','outro dono não apaga fotos alheias','passa',$q$delete from property_photos where property_id='aaaaaaa4-0000-0000-0000-000000000004'$q$);
reset role;
select v('ATAQUE@0061','…e as fotos continuam lá','select count(*)::text from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004''','8');

reset role; set role anon; select set_config('request.jwt.claims','{}',false);
select v('ATAQUE@0061','anônimo não vê fotos de rascunho','select count(*)::text from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004''','0');
reset role;
update properties set status='active' where id='aaaaaaa4-0000-0000-0000-000000000004';
set role anon; select set_config('request.jwt.claims','{}',false);
select v('NOVO@0061','anônimo vê as fotos do anúncio publicado','select count(*)::text from property_photos where property_id=''aaaaaaa4-0000-0000-0000-000000000004''','8');
reset role;
update properties set status='draft' where id='aaaaaaa4-0000-0000-0000-000000000004';
drop trigger properties_min_photos on public.properties;
