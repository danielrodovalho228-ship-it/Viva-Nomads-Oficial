-- 0348 (E1072, ORDEM-DUET-348 do Gerente, 21/11/2026): um bloco pode ser pago em PARTES.
--
-- Para quê: o registro do pagamento do bloco cobre o que o contrato diz (aluguel, contas do período e limpeza de
-- preparação). Quando o primeiro registro não cobre tudo — os registros de antes só tinham o aluguel —, o que falta
-- entra por um registro COMPLEMENTAR do mesmo bloco, com o seu recibo e a sua confirmação do morador. O bloco quita
-- quando a soma dos registros chega ao total.
--
-- O que muda: cada registro de valor mensal ganha o número da PARTE dentro do bloco (1 = o primeiro registro). A regra
-- "um pagamento de valor mensal ativo por bloco" (0182) passa a "um por bloco E parte": o clique duplo e o segundo
-- envio do mesmo registro continuam recusados pelo índice (os dois chegam com a mesma parte), e o complemento entra
-- com a parte seguinte.
--
-- O que NÃO faz: não regrava valor de nenhuma linha. As linhas que já existem ficam com parte = 1 (havia no máximo um
-- registro ativo por bloco). A caução não muda (continua uma por contrato). Sem dado pessoal.
alter table public.pagamentos_bloco add column if not exists parte integer not null default 1;
do $c$ begin
  alter table public.pagamentos_bloco add constraint pagamentos_bloco_parte_valida check (parte >= 1);
exception when duplicate_object then null; end $c$;

comment on column public.pagamentos_bloco.parte is 'E1072: número do registro dentro do bloco (1 = o primeiro; 2 em diante = registros complementares do mesmo bloco).';

-- O índice novo entra ANTES de o antigo sair: não há instante sem a regra de não repetição.
create unique index if not exists pagamentos_bloco_uma_parte_por_bloco
  on public.pagamentos_bloco (bloco_id, parte) where tipo = 'aluguel' and anulado_em is null;
drop index if exists public.pagamentos_bloco_um_valor_mensal;
