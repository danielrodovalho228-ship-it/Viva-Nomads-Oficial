-- Antes da 0072: salvar a qualificação de novo (sem documento) zera a aprovação.
reset role;
insert into public.properties (id, owner_id, title, city, status, monthly_price) values
 ('a7200000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Sem documento','Uberlândia','draft',2000);
insert into public.qualification_checklists (id, owner_id, property_id, document_path, document_status, document_reviewed_at, created_at)
values ('9c720000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111/doc-a.pdf','approved', now(), now() - interval '1 hour');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ANTES@0072','dono salva a qualificação de novo, sem documento','passa',$q$insert into qualification_checklists(id,owner_id,property_id) values ('9c720000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001')$q$);
reset role;
select v('ANTES@0072','…a mais recente perde a aprovação (BUG)','select document_status from qualification_checklists where id=''9c720000-0000-0000-0000-000000000002''','none');
delete from public.qualification_checklists where id = '9c720000-0000-0000-0000-000000000002';
