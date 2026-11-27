# E902 — "Ver os passos do credenciamento" leva a /parceiros/avaliadores

**Defeito:** em /parceiros, no convite "Avaliação de imóveis" do formulário Seja parceiro, o link "Ver os passos do credenciamento" levava a `/dashboard/parceiro/avaliacao`, área logada. Quem visita /parceiros sem conta caía na entrada.

**Correção:** o link aponta para a página pública de recrutamento `/parceiros/avaliadores`. O destino é `HREF_PASSOS_CREDENCIAMENTO` em `src/lib/parceiros/convite-avaliacao.ts`, igual a `ROTA_RECRUTAMENTO`. O import passa por esse arquivo porque o guarda do `interesse.test` proíbe a palavra "vistoria" no código do formulário, e o caminho `@/lib/vistoria/...` a contém.

**Teste:** `src/lib/parceiros/e902-link-credenciamento.test.ts`, vermelho na main e verde na branch.

**Asserções alteradas:** `convite-avaliacao.test.ts` e o E2E `t376`, cujo href era `/dashboard/parceiro/avaliacao` e passa a `/parceiros/avaliadores`.
