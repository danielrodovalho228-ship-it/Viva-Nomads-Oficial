-- Viva Nomads — aplicar 0299 (E440: contratos.proposta_id, o orçamento de origem do contrato). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0299_rollback.sql.
begin;
set local lock_timeout = '5s';

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

-- Conferência (somente leitura):
--   select count(*) filter (where proposta_id is not null) from public.contratos;
--   select has_column_privilege('authenticated', 'public.contratos', 'proposta_id', 'SELECT');  -- true

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000299', '0299_contrato_orcamento_origem_e440', array['-- conteúdo em supabase/migrations/0299_contrato_orcamento_origem_e440.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000299');
commit;
