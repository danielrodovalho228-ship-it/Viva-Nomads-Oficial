-- 0056 — A3 (revisão de documento, publicação, selos) + limites/idempotência.
-- Dono 1111 ainda sem qualificação aprovada.
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0056','dono envia checklist com documento','passa',$q$insert into qualification_checklists(id,owner_id,document_path,document_status,document_reviewed_by,ready_to_live_score,ready_to_live_badge) values ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','doc/m.pdf','approved','11111111-1111-1111-1111-111111111111',80,true)$q$);
select v('ATAQUE@0056','checklist nasce PENDENTE (mesmo pedindo approved)','select document_status || ''/'' || coalesce(document_reviewed_by::text,''-'') from qualification_checklists where id=''99999999-0000-0000-0000-000000000001''','pending/-');
select t('ATAQUE@0056','dono aprova o próprio documento (update)','falha',$q$update qualification_checklists set document_status='approved' where id='99999999-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0056','dono marca o próprio checklist como aprovado (status)','falha',$q$update qualification_checklists set status='approved' where id='99999999-0000-0000-0000-000000000001'$q$);
select t('ATAQUE@0056','dono publica imóvel novo sem documento aprovado','falha',$q$insert into properties(owner_id,title,city,status) values ('11111111-1111-1111-1111-111111111111','Pub','Uberlândia','active')$q$);
select t('NOVO@0056','dono ainda salva rascunho','passa',$q$insert into properties(id,owner_id,title,city,status) values ('aaaaaaa5-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Rasc 5','Uberlândia','draft')$q$);
select t('ATAQUE@0056','dono publica rascunho sem documento aprovado','falha',$q$update properties set status='active' where id='aaaaaaa5-0000-0000-0000-000000000005'$q$);
select t('NOVO@0056','dono edita preço de anúncio já ativo','passa',$q$update properties set monthly_price=3200 where id='aaaaaaa1-0000-0000-0000-000000000001'$q$);
select t('NOVO@0056','dono tenta inflar nota/avaliações/fotos/selo','passa',$q$update properties set rating=5, review_count=999, photo_count=50, listing_quality_tier='premium', work_ready_badge=true, ready_to_live_badge=true, ready_to_live_score=100 where id='aaaaaaa1-0000-0000-0000-000000000001'$q$);
reset role;
select v('ATAQUE@0056','... e nada disso grudou (selo = qualificação)','select concat_ws(''/'',coalesce(rating,0),coalesce(review_count,0),coalesce(photo_count,0),listing_quality_tier,coalesce(work_ready_badge,false)::text,ready_to_live_badge::text,ready_to_live_score) from properties where id=''aaaaaaa1-0000-0000-0000-000000000001''','0/0/0/padrao/false/true/80');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0056','dono envia foto (recálculo pelo banco)','passa',$q$insert into property_photos(property_id,url) values ('aaaaaaa1-0000-0000-0000-000000000001','f1.jpg')$q$);
reset role;
select v('NOVO@0056','photo_count recalculado pelo trigger do banco','select photo_count::text from properties where id=''aaaaaaa1-0000-0000-0000-000000000001''','1');

-- Admin revisa (não o próprio).
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0056','admin aprova documento do dono','passa',$q$update qualification_checklists set document_status='approved', document_reviewed_by='44444444-4444-4444-4444-444444444444', document_reviewed_at=now() where id='99999999-0000-0000-0000-000000000001'$q$);
select t('NOVO@0056','admin envia o próprio checklist','passa',$q$insert into qualification_checklists(id,owner_id,document_path) values ('99999999-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444','doc/a.pdf')$q$);
select t('ATAQUE@0056','admin aprova o PRÓPRIO documento','falha',$q$update qualification_checklists set document_status='approved' where id='99999999-0000-0000-0000-000000000004'$q$);
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0056','com documento aprovado, dono publica o rascunho','passa',$q$update properties set status='active' where id='aaaaaaa5-0000-0000-0000-000000000005'$q$);

-- Limites e idempotência: só o servidor.
reset role; set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select v('NOVO@0056','consumir_limite: 1º uso permitido','select consumir_limite(''teste:x'',2,3600)::text','true');
select v('NOVO@0056','consumir_limite: 2º uso permitido','select consumir_limite(''teste:x'',2,3600)::text','true');
select v('ATAQUE@0056','consumir_limite: 3º uso barrado','select consumir_limite(''teste:x'',2,3600)::text','false');
select v('NOVO@0056','consumir_limite: outra chave tem seu saldo','select consumir_limite(''teste:y'',2,3600)::text','true');
select t('NOVO@0056','reserva a comissão de uma candidatura','passa',$q$insert into cobrancas_fechamento(lead_id,tipo) select id,'comissao' from leads limit 1$q$);
select t('ATAQUE@0056','segunda comissão da MESMA candidatura','falha',$q$insert into cobrancas_fechamento(lead_id,tipo) select id,'comissao' from leads limit 1$q$);
reset role; set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select t('ATAQUE@0056','usuário não executa consumir_limite','falha',$q$select consumir_limite('teste:z',100,3600)$q$);
select t('ATAQUE@0056','usuário não lê limites_uso','falha',$q$select * from limites_uso$q$);
select t('ATAQUE@0056','usuário não lê cobrancas_fechamento','falha',$q$select * from cobrancas_fechamento$q$);
reset role;
