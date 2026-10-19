-- Viva Nomads — 0171: taxa da proposta fixada no ENVIO (complemento do prompt 27, parte B — regra do Daniel, 18/10).
-- No aceite vale a menor entre taxa_no_envio e a faixa atual: a taxa nunca sobe depois de enviada.
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
