-- Rollback da 0296 (E486): sai a estadia de teste da inquilino2@ e o que a prova da manutenção fez nela — as
-- solicitações de manutenção do contrato (service_orders, que não cascateiam), pedidos de parceiro, pendências de
-- conforto e documentos fiscais ligados ao contrato e as chaves de envio que o citam; o registro VN-CT-E4860000 fica
-- anulado (não pode ser apagado); o
-- contrato leva blocos, pagamentos, eventos e demais filhos em cascata. Nada de outro contrato, anúncio ou conta é
-- tocado (tudo pelo id fixo e4860000-…); a seed do D-5 (d5d50247…) fica como está.
begin;
set local lock_timeout = '5s';
do $$
declare
  c_contrato constant uuid := 'e4860000-0000-4000-8000-0000000000c1';
begin
  delete from public.automacoes_envios where chave like '%' || c_contrato::text || '%';
  delete from public.service_orders where contrato_id = c_contrato;
  delete from public.parceiro_pedidos where contrato_id = c_contrato;
  delete from public.conforto_pendencias where contrato_id = c_contrato;
  delete from public.documentos_fiscais where contrato_id = c_contrato;
  -- documentos_registro é imutável (o gatilho barra o DELETE): o VN-CT fica ANULADO, com o motivo, e segue is_teste.
  update public.documentos_registro
     set status = 'anulado', anulado_motivo = 'Estadia de teste do E486 removida (rollback 0296).'
   where status = 'valido' and ref_tabela = 'contratos' and ref_id = c_contrato;
  delete from public.contratos where id = c_contrato;
end
$$;
delete from supabase_migrations.schema_migrations where version = '20261105000296';
commit;
