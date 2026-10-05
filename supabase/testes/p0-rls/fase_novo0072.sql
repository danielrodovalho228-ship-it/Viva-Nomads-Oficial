-- 0072 — salvar de novo mantém o documento e a revisão; documento novo reanalisa.
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0072','dono salva de novo, sem documento','passa',$q$insert into qualification_checklists(id,owner_id,property_id,formulario) values ('9c720000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','{"elig":{"furnished":true}}')$q$);
reset role;
select v('NOVO@0072','…herda documento e aprovação','select document_status || ''|'' || document_path from qualification_checklists where id=''9c720000-0000-0000-0000-000000000003''','approved|11111111-1111-1111-1111-111111111111/doc-a.pdf');
select v('NOVO@0072','…e guarda o formulário','select formulario->''elig''->>''furnished'' from qualification_checklists where id=''9c720000-0000-0000-0000-000000000003''','true');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0072','dono envia documento NOVO','passa',$q$insert into qualification_checklists(id,owner_id,property_id,document_path) values ('9c720000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111/doc-b.pdf')$q$);
reset role;
select v('NOVO@0072','…documento novo volta para análise','select document_status from qualification_checklists where id=''9c720000-0000-0000-0000-000000000004''','pending');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0072','dono tenta gravar "aprovado" direto','passa',$q$insert into qualification_checklists(id,owner_id,property_id,document_path,document_status) values ('9c720000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','x/doc-c.pdf','approved')$q$);
reset role;
select v('ATAQUE@0072','…o banco ignora e põe em análise','select document_status from qualification_checklists where id=''9c720000-0000-0000-0000-000000000005''','pending');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0072','dono salva sem documento num imóvel SEM aprovação prévia','passa',$q$insert into qualification_checklists(id,owner_id,property_id) values ('9c720000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','a7200000-0000-0000-0000-000000000001')$q$);
reset role;
select v('ATAQUE@0072','…não herda o documento de OUTRO imóvel','select document_status from qualification_checklists where id=''9c720000-0000-0000-0000-000000000006''','none');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0072','dono altera o formulário de uma linha gravada','falha',$q$update qualification_checklists set formulario='{}' where id='9c720000-0000-0000-0000-000000000003'$q$);
reset role;
-- Re-salvar com o documento ainda em análise: 2 linhas pendentes do mesmo arquivo.
reset role;
insert into public.qualification_checklists (id, owner_id, property_id, document_path, document_status) values
 ('9c720000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','a7200000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111/doc-z.pdf','pending');
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0072','dono re-salva com documento ainda em análise','passa',$q$insert into qualification_checklists(id,owner_id,property_id) values ('9c720000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','a7200000-0000-0000-0000-000000000001')$q$);
reset role;
select v('NOVO@0072','…a nova herda o documento em análise','select document_status || ''|'' || document_path from qualification_checklists where id=''9c720000-0000-0000-0000-000000000007''','pending|11111111-1111-1111-1111-111111111111/doc-z.pdf');
set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0072','admin aprova o documento (todas as linhas dele)','passa',$q$update qualification_checklists set document_status='approved', document_reviewed_at=now(), document_reviewed_by='44444444-4444-4444-4444-444444444444' where owner_id='11111111-1111-1111-1111-111111111111' and property_id='a7200000-0000-0000-0000-000000000001' and document_path='11111111-1111-1111-1111-111111111111/doc-z.pdf' and document_status='pending'$q$);
reset role;
select v('NOVO@0072','…as 2 linhas do documento ficam aprovadas','select count(*)::text from qualification_checklists where document_path=''11111111-1111-1111-1111-111111111111/doc-z.pdf'' and document_status=''approved''','2');
delete from public.qualification_checklists where id::text like '9c720000%';
