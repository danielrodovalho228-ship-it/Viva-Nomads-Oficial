-- 0299 — E440: o contrato CARREGA o número do orçamento de origem. Antes, só o pedido (lead_id) ficava no contrato e a
-- tela deduzia "a proposta aceita mais recente do mesmo pedido" — ambíguo se houvesse mais de uma. Agora o registro do
-- contrato grava a proposta acordada (contratos.proposta_id). Não toca o texto jurídico do contrato nem o seed
-- VN-CT-D5D50247 (sem pedido). Idempotente. Desfazer: supabase/producao/rollback/0299_rollback.sql.
alter table public.contratos add column if not exists proposta_id uuid references public.propostas (id) on delete set null;
comment on column public.contratos.proposta_id is 'E440: o orçamento (proposta ORC-…) que originou este contrato — a cadeia pedido VN-PD → orçamento ORC → contrato VN-CT por um número só.';
-- A coluna segue o padrão de leitura por coluna da tabela (0177): quem é parte lê o vínculo; só o servidor grava.
grant select (proposta_id) on public.contratos to authenticated;
-- Contratos que já existem: o orçamento aceito mais recente do mesmo pedido (a regra que a tela usava até aqui).
update public.contratos c
   set proposta_id = (
     select p.id from public.propostas p
      where p.lead_id = c.lead_id and p.status in ('aceita', 'em_contrato', 'contrato_assinado')
      order by p.aceita_em desc nulls last
      limit 1)
 where c.proposta_id is null and c.lead_id is not null;
