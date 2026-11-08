# E679-B, parte 3 — conduta do avaliador: confirmada NÃO cega, corrigida (migração 0324)

Empilhado sobre o PR 2/3. Produção conferida em 07/11/2026: `vistoria_conduta` com 0 linhas.

## (c) Evidência: a avaliação de conduta NÃO era cega
- `supabase/migrations/0215_avaliadores_credenciados.sql`, política `vistoria_conduta_le`: o dono do pedido e o avaliador designado liam as DUAS avaliações assim que gravadas (cada um via a do outro antes de enviar a sua).
- `src/lib/vistoria/actions.ts` (`avaliarConduta`): gravava direto, sem etapa de publicação.
- `avaliadores_publicos()` (0215 e 0220) e `revisarCriterios` (`src/lib/vistoria/servidor.ts`, E648) contavam a nota do dono na hora.

## Correção (mesmo modelo cego da estadia, sem segundo motor de ideias)
- `publicada_em` em `vistoria_conduta`. `publicar_conduta_avaliador()` publica quando os DOIS enviam OU quando a janela de 14 dias, contada do laudo emitido, fecha (cron diário, junto das avaliações de parceiro; também logo após cada envio).
- RLS: cada lado lê a própria; a do outro só depois de publicada; admin lê todas.
- Gatilho: só depois do laudo emitido, até 14 dias dele; sem edição depois de enviada.
- A nota pública do avaliador e a revisão de critérios contam só o publicado.

## O que NÃO mudou (confirmado)
Dono avalia pontualidade · cordialidade · cuidado com o imóvel; avaliador avalia imóvel pronto · horário respeitado; abre depois do laudo; texto até 300 caracteres sem citar o resultado (`validarConduta`); avaliador × morador não existe (nenhuma linha, tabela nem ação para isso).

## Prova
Testes antes (vermelhos): `src/lib/vistoria/conduta-cega-e679.test.ts` (4) e `tests/migracoes/conduta-cega-0324.test.ts` (4). Cenário num Postgres 16 local, com migração e `aplicar` repetidos e rollback + reaplicação: sem laudo recusa; dono avalia e NÃO fica publicada nem entra na nota pública; o avaliador não lê a do dono, o dono lê a própria; quando o avaliador envia as duas publicam juntas e a nota pública vira 3,0; edição recusada; laudo de 15 dias publica pelo cron e o envio fora da janela é recusado.

## Dúvidas
1. A janela conta do PRIMEIRO laudo emitido do pedido (a contestação gera pedido novo, com o próprio laudo).
2. Pedidos de vistoria já `laudo_emitido` há mais de 14 dias não aceitam mais conduta nova (hoje não há linha nenhuma).
