# E725 — total calculado para estadia abaixo do mínimo (Phoenix, RELATORIO-002, A4)

**Defeito:** com 29 noites, o cartão do anúncio mostrava o total (R$ 3.731,67) junto ao aviso "Estadia mínima de 30 dias" — uma estadia inválida sendo precificada.
**Regra:** abaixo do mínimo só o aviso; nada de total, nem na barra do celular nem no resumo da candidatura.
**Correção (sem migração):**
- `src/lib/availability.ts`: `estadiaMinimaDias` e `abaixoDaEstadiaMinima` — o mínimo em um lugar só, o mesmo de `validarReserva` (que gera o aviso).
- `property-detail.tsx`: abaixo do mínimo, `diasSelecao` fica `null`; o cartão lateral (`PriceCard`), a barra fixa e o resumo deixam de receber a duração e não calculam o total.
- `price-card.tsx`: nova prop `estadiaMinimaAviso`; mostra "Estadia mínima de N dias." no lugar do total da estadia.
Teste: `src/lib/e725-estadia-abaixo-do-minimo.test.ts` (4). O total mensal (preço por mês) segue visível: ele não é a estadia. Sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.
