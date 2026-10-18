-- Prompt 24 (item 6) — destravar dados de QA. NÃO é migração de esquema: só limpa dados de CONTAS DE TESTE.
-- Idempotente: rodar de novo não muda nada. Aplicação manual pelo Daniel (SQL Editor do Supabase).
--
-- Libera a reserva "contrato" (cobrancas_fechamento) de candidaturas em que as DUAS partes são is_teste e que
-- não chegaram a ter o contrato registrado — ou cuja reserva ficou sem conclusão (externo_id vazio).
-- Com o código do prompt 24 isto deixa de ser necessário: a reserva sem conclusão vence em 10 minutos e a reserva
-- concluída devolve o contrato existente (200) em vez de 409.
begin;

delete from public.cobrancas_fechamento cf
using public.leads l, public.profiles po, public.profiles pt
where cf.lead_id = l.id
  and cf.tipo = 'contrato'
  and po.id = l.owner_id
  and pt.id = l.tenant_id
  and po.is_teste is true
  and pt.is_teste is true
  and (
    cf.externo_id is null
    or not exists (select 1 from public.contratos c where c.lead_id = cf.lead_id)
  );

commit;
