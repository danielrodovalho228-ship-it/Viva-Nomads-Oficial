-- Laboratório (nunca em produção): prova da 0185 — decisão de documento avisada UMA vez por imóvel.
-- Roda tudo dentro de begin/rollback; não deixa nada gravado. Esperado (coluna count):
--   com 1 pendente 0 · último decidido 7 (4 aprovados) · de novo 0 · atrasadas 1 · cron força 1 · cron de novo 0 · redecidido 2
-- Uso: psql "$LAB_DB" -v ON_ERROR_STOP=1 -f supabase/lab/teste-0185-aviso-documento.sql
begin;
create temp table alvo as
  select p.owner_id, p.id as property_id, (select id from profiles where role = 'admin' limit 1) as admin_id from properties p limit 1;
-- 7 documentos do mesmo imóvel na fila; decide 6 → nada; decide o 7º → 7 linhas; de novo → 0.
create temp table ids as
  select gen_random_uuid() as id, n from generate_series(1,7) n;
insert into qualification_checklists (id, owner_id, property_id, document_path, document_status)
  select id, (select owner_id from alvo), (select property_id from alvo), 'teste/doc-'||n||'.pdf', 'pending' from ids;
update qualification_checklists set document_status = case when n <= 4 then 'approved' else 'rejected' end,
       document_review_reason = case when n <= 4 then null else 'motivo '||n end,
       document_reviewed_at = now(), document_reviewed_by = (select admin_id from alvo)
  from ids where ids.id = qualification_checklists.id and ids.n <= 6;
select 'com 1 pendente' as caso, count(*) from decisoes_documento_para_avisar((select owner_id from alvo),(select property_id from alvo));
update qualification_checklists set document_status='rejected', document_review_reason='motivo 7', document_reviewed_at=now(), document_reviewed_by=(select admin_id from alvo)
  from ids where ids.id = qualification_checklists.id and ids.n = 7;
select 'último decidido' as caso, count(*), sum(case when aprovado then 1 else 0 end) aprovados from decisoes_documento_para_avisar((select owner_id from alvo),(select property_id from alvo));
select 'de novo' as caso, count(*) from decisoes_documento_para_avisar((select owner_id from alvo),(select property_id from alvo));
-- cron: decisão antiga não avisada com outro pendente
insert into qualification_checklists (owner_id, property_id, document_path, document_status) values ((select owner_id from alvo),(select property_id from alvo),'teste/doc-8.pdf','pending');
insert into qualification_checklists (owner_id, property_id, document_path, document_status, document_reviewed_at, document_reviewed_by) values ((select owner_id from alvo),(select property_id from alvo),'teste/doc-9.pdf','approved', now() - interval '3 hours', (select admin_id from alvo));
select 'atrasadas' as caso, count(*) from decisoes_documento_atrasadas(2) where property_id=(select property_id from alvo);
select 'cron força' as caso, count(*) from decisoes_documento_para_avisar((select owner_id from alvo),(select property_id from alvo), true);
select 'cron de novo' as caso, count(*) from decisoes_documento_atrasadas(2) where property_id=(select property_id from alvo);
-- reaberto e decidido de novo volta a avisar
update qualification_checklists set document_status='approved', document_reviewed_at = now() + interval '1 minute' where document_path='teste/doc-5.pdf';
update qualification_checklists set document_status='approved', document_reviewed_at = now() + interval '1 minute', document_reviewed_by=(select admin_id from alvo) where document_path='teste/doc-8.pdf';
select 'redecidido' as caso, count(*) from decisoes_documento_para_avisar((select owner_id from alvo),(select property_id from alvo));
rollback;
