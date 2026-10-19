-- Viva Nomads — 0171: taxa da proposta fixada no envio (complemento do prompt 27, parte B — regra do Daniel, 18/10). Idempotente.
-- Rollback: supabase/producao/rollback/0171_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

alter table public.propostas add column if not exists taxa_no_envio numeric(5, 4);
alter table public.propostas drop constraint if exists propostas_taxa_no_envio_valida;
alter table public.propostas add constraint propostas_taxa_no_envio_valida
  check (taxa_no_envio is null or (taxa_no_envio >= 0 and taxa_no_envio < 1));
-- Propostas antigas: a já aceita fica com a taxa congelada; as demais, com a faixa do dono NO MOMENTO DESTA MIGRAÇÃO
-- (imóveis ativos; as mesmas faixas de src/lib/cobranca/regra.ts — um teste confere).
update public.propostas p
   set taxa_no_envio = coalesce(
         p.taxa_congelada,
         (select case
                   when count(*) <= 2 then 0.12
                   when count(*) <= 5 then 0.10
                   when count(*) <= 15 then 0.08
                   else 0.06
                 end
            from public.properties pr
           where pr.owner_id = p.owner_id and pr.status = 'active'))
 where p.taxa_no_envio is null;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000171', '0171_propostas_taxa_no_envio',
       array['-- conteúdo em supabase/migrations/0171_propostas_taxa_no_envio.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000171');
commit;
