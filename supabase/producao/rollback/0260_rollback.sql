-- Rollback da 0260: sai o contrato da prova (pelo id fixo) com tudo o que a prova criou nele (blocos, aditivos,
-- assinaturas, códigos, pagamentos e eventos saem em cascata com o contrato), o registro VN-CT dele e as chaves de
-- envio do lembrete. Nada de outro contrato é tocado.
begin;
set local lock_timeout = '5s';
delete from public.automacoes_envios where chave like 'bloco_inicio_lembrete:a0260000-0000-4000-8000-000000000001:%';
delete from public.documentos_registro
 where (ref_tabela = 'contratos' and ref_id = 'a0260000-0000-4000-8000-000000000001')
    or (ref_tabela = 'contrato_aditivos' and ref_id in (select id from public.contrato_aditivos where contrato_id = 'a0260000-0000-4000-8000-000000000001'));
delete from public.contratos where id = 'a0260000-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261030000260';
commit;
