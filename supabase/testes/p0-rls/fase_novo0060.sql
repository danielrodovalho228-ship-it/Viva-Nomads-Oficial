-- 0060 — qualificação POR IMÓVEL.
reset role;
select v('NOVO@0060','dados: dono com 1 imóvel tem o checklist ligado a ele','select coalesce(property_id::text,''-'') from qualification_checklists where id=''99999999-0000-0000-0000-000000000055''','aaaaaaa3-0000-0000-0000-000000000003');
select v('NOVO@0060','dados: dono com vários imóveis fica sem imóvel (reenviar)','select coalesce(property_id::text,''-'') from qualification_checklists where id=''99999999-0000-0000-0000-000000000001''','-');

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0060','documento aprovado de OUTRO imóvel não publica este','falha',$q$update properties set status='active' where id='aaaaaaa2-0000-0000-0000-000000000002'$q$);
select t('ATAQUE@0060','dono liga checklist ao imóvel de OUTRA pessoa (insert)','falha',$q$insert into qualification_checklists(owner_id,property_id,document_path) values ('11111111-1111-1111-1111-111111111111','aaaaaaa3-0000-0000-0000-000000000003','doc/x.pdf')$q$);
select t('ATAQUE@0060','dono altera nota do próprio checklist','falha',$q$update qualification_checklists set ready_to_live_score=100 where id='99999999-0000-0000-0000-000000000001'$q$);
select t('NOVO@0060','dono liga o checklist aprovado ao imóvel 2','passa',$q$update qualification_checklists set property_id='aaaaaaa2-0000-0000-0000-000000000002' where id='99999999-0000-0000-0000-000000000001'$q$);
select t('NOVO@0060','com o documento DESTE imóvel aprovado, publica','passa',$q$update properties set status='active' where id='aaaaaaa2-0000-0000-0000-000000000002'$q$);
select t('ATAQUE@0060','o mesmo checklist não é reaproveitado em outro imóvel','falha',$q$update qualification_checklists set property_id='aaaaaaa4-0000-0000-0000-000000000004' where id='99999999-0000-0000-0000-000000000001'$q$);
select t('NOVO@0060','checklist novo (pendente) para o imóvel 4','passa',$q$insert into qualification_checklists(id,owner_id,property_id,document_path,ready_to_live_score,ready_to_live_badge) values ('99999999-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','aaaaaaa4-0000-0000-0000-000000000004','doc/n.pdf',30,false)$q$);
select t('ATAQUE@0060','imóvel 4 não publica com o documento dele pendente','falha',$q$update properties set status='active' where id='aaaaaaa4-0000-0000-0000-000000000004'$q$);
select t('NOVO@0060','documento pendente do 4 NÃO trava a edição do 2 (publicado)','passa',$q$update properties set monthly_price=3500 where id='aaaaaaa2-0000-0000-0000-000000000002'$q$);
select t('NOVO@0060','edição do 4 (rascunho) segue normal','passa',$q$update properties set monthly_price=2100 where id='aaaaaaa4-0000-0000-0000-000000000004'$q$);
reset role;
select v('NOVO@0060','selo do imóvel 2 = o checklist DELE','select ready_to_live_score::text || ''/'' || ready_to_live_badge::text from properties where id=''aaaaaaa2-0000-0000-0000-000000000002''','80/true');
select v('NOVO@0060','selo do imóvel 4 = o checklist DELE (não o do 2)','select ready_to_live_score::text || ''/'' || ready_to_live_badge::text from properties where id=''aaaaaaa4-0000-0000-0000-000000000004''','30/false');

set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0060','admin aprova o documento do imóvel 4','passa',$q$update qualification_checklists set document_status='approved', document_reviewed_by='44444444-4444-4444-4444-444444444444', document_reviewed_at=now() where id='99999999-0000-0000-0000-000000000006'$q$);
select t('ATAQUE@0060','admin não troca o documento do checklist','falha',$q$update qualification_checklists set document_path='doc/outro.pdf' where id='99999999-0000-0000-0000-000000000006'$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('NOVO@0060','com o documento do 4 aprovado, o 4 publica','passa',$q$update properties set status='active' where id='aaaaaaa4-0000-0000-0000-000000000004'$q$);
reset role;
