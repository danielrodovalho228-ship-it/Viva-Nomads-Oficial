# E815 — "Incluído no preço" × composição do mês

**Achado** (RELATORIO-011, ube-002): as Regras diziam "Incluído no preço — Água e internet", mas a composição do mês
cobrava "Água, luz e gás (estimativa) R$ 200". A regra prometia incluído o que a composição cobrava.

**Causa.** As duas informações vinham de campos independentes: `detalhesAnuncio.incluidoNoPreco`, que o dono marca, e
os campos de custo (`utilitiesMode`, `utilitiesEstimate`, `condoFee`), que montam a composição. Nada conferia um com o
outro.

**Uma só verdade.** A composição manda, porque é o dinheiro. "Incluído no preço" é o que o valor mensal já cobre, então
`incluidosCoerentes` (`src/lib/anuncio/detalhes-anuncio.ts`) tira da lista:
- água, luz e gás, quando há estimativa cobrada (modo fixo com valor > 0) ou quando as contas são medidas à parte
  (modo real);
- condomínio, quando há condomínio cobrado.

As Regras da estadia (`stay-rules.tsx`) passam os custos do anúncio para `linhasDetalhes`. Sem os custos, a lista segue
como foi gravada. O dado do ube-002 também foi corrigido para `incluidoNoPreco: ["internet"]`.

**Teste.** `src/lib/anuncio/e815-incluido-x-composicao.test.ts` (4): falha na main (o export não existe) e passa na
branch.
- ube-002 mostra só "Internet".
- Nenhum exemplo diz "incluído" o que a composição cobra.
- A regra nos 4 casos.
- A página passa os custos para as Regras.
