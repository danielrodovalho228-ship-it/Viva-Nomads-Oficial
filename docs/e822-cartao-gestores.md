# E822 — o cartão "Gestores e administradoras" sem destino em /parceiros

**Achado** (RELATORIO-012). Em /parceiros, o cartão "Gestores e administradoras" era o único cartão de categoria sem
link nem botão. Justamente o do público de maior valor (Plano Gestor, 4%, 20+ imóveis).

**Causa.** O cartão tinha um link só, "Ver o Plano Gestor" → `/precos#plano-gestor` (E302), e ele passava por
`comPortasDePrecos`. Com a página de preços **suspensa** (E563, chave `PRECOS_VISIVEL` desligada), esse filtro tira os
links de /precos, e o cartão ficava com a lista vazia.

**Correção.** `linksDoGestor` (`src/lib/parceiros/cartao-gestores.ts`) nunca devolve lista vazia:
- com a página de preços ligada, segue para `/precos#plano-gestor`, como no E302;
- com ela suspensa, como hoje, vai para `/para-proprietarios#plano-gestor`. É o parágrafo da taxa com "Plano Gestor:
  {GESTOR_TEXTO}" (E805), que ganhou o `id="plano-gestor"`.

O cartão mantém o padrão dos demais: um link sublinhado, com o mesmo rótulo "Ver o Plano Gestor".

**Teste.** `src/lib/parceiros/e822-cartao-gestores.test.ts` (4): falha na main (o módulo não existe) e passa na branch.
- Com os preços suspensos, o destino é /para-proprietarios.
- Com os preços ligados, é /precos.
- A âncora existe.
- Todos os cartões têm um `links:` não vazio, e nenhum é filtrado direto pela chave de preços.

**Asserções alteradas:**
- `e563-precos-suspensa.test.ts`: a porta do cartão de parceiros mora em `linksDoGestor`.
- `parceiros/bloco-parceiro-e301.test.ts`: o link do E302 mora em `cartao-gestores.ts`.
