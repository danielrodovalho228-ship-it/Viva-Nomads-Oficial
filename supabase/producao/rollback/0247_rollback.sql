-- Rollback da 0247: remove TUDO o que a prova D-5 criou, pelos ids fixos d5d50247-…, nesta ordem:
--   1. mensagens dos pedidos automáticos nascidos da prova (messages → parceiro_pedidos não cascateia);
--   2. pedidos automáticos da prova (contrato, vínculo ou parceiro de teste); eventos/entregas/avaliações caem junto;
--   3. registros de envio de automação ligados ao contrato da prova (automacoes_envios, pela chave);
--   4. o vínculo de limpeza, o serviço, o perfil de parceiro e a solicitação ativada;
--   5. o contrato (os blocos, eventos e demais filhos caem em cascata);
--   6. o registro do documento (VN-CT-D5D50247 e os VN-SV dos pedidos) NÃO pode ser apagado: documentos_registro é
--      imutável por regra do banco. Ele fica ANULADO, com o motivo, e segue marcado is_teste;
--   7. o registro da migração em schema_migrations.
-- Nada fora desses ids é tocado; as contas de teste continuam como estavam.
begin;
set local lock_timeout = '5s';

delete from public.messages
 where parceiro_pedido_id in (
   select id from public.parceiro_pedidos
    where contrato_id = 'd5d50247-0000-4000-8000-00000000c001'
       or vinculo_id = 'd5d50247-0000-4000-8000-00000000a004'
       or parceiro_id = 'd5d50247-0000-4000-8000-00000000a002');

update public.documentos_registro
   set status = 'anulado', anulado_motivo = 'Dados de teste da prova D-5 removidos (rollback 0247).'
 where status = 'valido'
   and ((ref_tabela = 'contratos' and ref_id = 'd5d50247-0000-4000-8000-00000000c001')
     or (ref_tabela = 'parceiro_pedidos' and ref_id in (
          select id from public.parceiro_pedidos
           where contrato_id = 'd5d50247-0000-4000-8000-00000000c001'
              or vinculo_id = 'd5d50247-0000-4000-8000-00000000a004'
              or parceiro_id = 'd5d50247-0000-4000-8000-00000000a002')));

delete from public.parceiro_pedidos
 where contrato_id = 'd5d50247-0000-4000-8000-00000000c001'
    or vinculo_id = 'd5d50247-0000-4000-8000-00000000a004'
    or parceiro_id = 'd5d50247-0000-4000-8000-00000000a002';

delete from public.automacoes_envios where chave like '%d5d50247-0000-4000-8000-00000000c001%';

delete from public.imovel_parceiros where id = 'd5d50247-0000-4000-8000-00000000a004';
delete from public.parceiro_servicos where id = 'd5d50247-0000-4000-8000-00000000a003';
delete from public.parceiros where id = 'd5d50247-0000-4000-8000-00000000a002';
delete from public.parceiro_solicitacoes where id = 'd5d50247-0000-4000-8000-00000000a001';

delete from public.contratos where id = 'd5d50247-0000-4000-8000-00000000c001';

delete from supabase_migrations.schema_migrations where version = '20261025000247';
commit;
