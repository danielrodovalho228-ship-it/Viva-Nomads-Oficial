-- 0283 — Vínculo profissional: o pedido novo fica SEPARADO do vínculo confirmado (ordem do Daniel, 02/11: "preservar o
-- vínculo atual — nunca apagar"). `dominio` + `confirmado_em` são o selo ativo e só mudam quando a pessoa confirma o
-- código do pedido novo; `pedido_dominio` guarda o domínio do pedido em andamento. Recusa, expiração ou bloqueio do pedido
-- novo não tocam o selo. (0282 fica reservada ao achado 127.)
alter table public.vinculo_profissional
  add column if not exists pedido_dominio text
  check (pedido_dominio is null or (pedido_dominio = lower(pedido_dominio) and pedido_dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'));

-- Linhas sem selo: o domínio gravado era o do pedido em andamento.
update public.vinculo_profissional set pedido_dominio = dominio where confirmado_em is null and pedido_dominio is null;

comment on column public.vinculo_profissional.pedido_dominio is
  'Domínio do pedido de vínculo em andamento. O selo (dominio + confirmado_em) só troca quando este pedido é confirmado.';
