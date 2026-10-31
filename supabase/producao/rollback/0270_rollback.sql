-- Rollback da 0270: o anúncio da reprova do E274 volta a rascunho (fora da busca) e sai da fila o cartão da inquilino2
-- que ainda NÃO saiu (um e-mail já enviado fica registrado). O rascunho volta sem o draft_data (a descrição fica na coluna).
begin;
set local lock_timeout = '5s';
delete from public.emails_proativos
 where evento = 'pedido_imovel_novo' and ref_id = 'a0269000-0000-4000-8000-000000000001' and enviado_em is null;
update public.properties set status = 'draft' where id = 'a0269000-0000-4000-8000-000000000001' and status = 'active';
delete from supabase_migrations.schema_migrations where version = '20261031000270';
commit;
