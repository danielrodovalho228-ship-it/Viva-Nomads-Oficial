# E896 — o cartão "Gestores e administradoras" em /parceiros nunca fica sem saída

**Prova (Lótus, RELATORIO-L-004, PROVADO):**
- A introdução de /parceiros diz: "Empresas e gestores têm página própria".
- O cartão "Gestores e administradoras" não tinha nenhum link; a zona de links estava vazia no HTML.

**Causa:** o único link do cartão era "Ver o Plano Gestor" (`/precos#plano-gestor`), filtrado por `comPortasDePrecos`. Com a página de preços suspensa (E563, `PRECOS_VISIVEL` desligada), ele some.

**Correção:** `linksDoCartaoGestores(precosVisivel)` em `src/lib/parceiros/tipos-parceria.ts`.
- Com os preços visíveis, segue "Ver o Plano Gestor" (E302).
- Com os preços suspensos, "Taxas e Plano Gestor" leva a `/para-proprietarios#taxa`, o parágrafo com a escada de taxas e o Plano Gestor (`FRASE_ESCADA_TAXAS`), que ganha o `id="taxa"`.

**Teste:** `src/lib/parceiros/e896-cartao-gestores.test.ts` (4 casos), vermelho na main e verde na branch.

**Asserções alteradas:** `e563-precos-suspensa.test.ts` e `bloco-parceiro-e301.test.ts`. O link "Ver o Plano Gestor" agora mora em `tipos-parceria.ts`, com a mesma chave.
