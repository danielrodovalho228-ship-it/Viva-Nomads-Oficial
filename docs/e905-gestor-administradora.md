# E905 — Plano Gestor com "ou conta de administradora" em /para-proprietarios e /como-funciona

**Defeito:** /para-proprietarios e /como-funciona diziam só "4% para carteiras de 20 ou mais imóveis". A home já diz "ou para administradoras", e a Ajuda já diz "ou conta de administradora" (`PORTA_GESTOR_TEXTO`).

**Correção:** o texto único das telas, `GESTOR_TEXTO` em `src/config/planos.ts`, passa a "4% para carteiras de 20 ou mais imóveis ou conta de administradora, com cadastro assistido da carteira e contato direto na Viva".
- /para-proprietarios e /como-funciona mostram o Gestor pela `FRASE_ESCADA_TAXAS`, que usa essa constante.
- /parceiros (cartão dos gestores) e /precos usam a mesma constante e ficam iguais.

**Teste:** `src/lib/planos/e905-gestor-administradora.test.ts`, vermelho na main e verde na branch.

**Asserções alteradas:** `e564-textos-gestor.test.ts` e `planos/gestor-minimo-textos.test.ts`, que fixavam o texto antigo.
