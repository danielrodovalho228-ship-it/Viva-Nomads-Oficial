# E755 — catálogo da /buscar estável entre carregamentos

**Relato (Phoenix, RELATORIO-004, C4):** às 15h25 os 2 primeiros cartões eram "Apartamento no Santa Mônica — 1 quarto" (R$ 3.800) e "Quitinete no Centro" (R$ 2.300); às 15h27, sem mudar a busca, "Imóvel mobiliado com home office no Santa Mônica" (R$ 3.960) e "Studio premium no Centro" (R$ 3.130); total 15 nos dois.

## O que se confirmou no código e nos dados (só leitura)
- Sem sorteio: `/buscar` não tem `Math.random`/shuffle; o rodízio por dia (`sementeDoDia`) é só da home; `SAMPLE_PROPERTIES` é fixo (15 itens, `src/lib/properties.ts`, sem mudança desde 05/11).
- Os títulos das 15h25 **não existem** no repositório nem no banco de produção (11 anúncios ativos, todos de teste/reteste). Os das 15h27 são o catálogo de exemplo do código (`SAMPLE_PROPERTIES`). Logo, as 15h25 não vieram deste código/banco: provável outro ambiente (lab/preview com massa própria) ou conta de teste vendo anúncios de teste (E571). **Mecanismo da troca não provado**; pedido ao QA: informar a URL/ambiente das 15h25.
- A página é ISR (`revalidate = 60`) e, se a leitura falha, cai para só os exemplos (`withDemos([])`) — esse resultado também fica em cache por 60 s. Hipótese plausível para uma troca "real → exemplos" entre cargas; não alterei esse fallback (decisão de produto: nunca 500).

## O defeito de instabilidade que existia e foi corrigido
- Ordem sem desempate: a lista vinha de `order by created_at desc` e o cliente ordenava por prioridade/preço/distância sem desempate. Linhas com o mesmo `created_at` (lotes de massa, ex.: os pares "Resumo semanal 0276 A/B") saem em ordem arbitrária entre consultas/instâncias, trocando os primeiros cartões.
- Correção (sem migração): `.order("id")` após `created_at` nas 3 consultas de `src/lib/data/properties.ts`; `desempatePorId` (`src/lib/busca/ordem-estavel.ts`) em todas as ordenações de `search-client.tsx`.

## Prova
`src/lib/busca/e755-vitrine-estavel.test.ts` (4): desempate pelo id independe da ordem de entrada (25 embaralhamentos), catálogo de exemplo fixo (15, ids únicos), consultas com `created_at` + `id`, sem sorteio na busca. Sem prova ao vivo.

## Atualização 09/11 — o que se sabe do mecanismo (leitura apenas, sem mudar código)
- O conjunto das 15h27 ("Imóvel mobiliado com home office no Santa Mônica" R$ 3.200 de base, "Studio premium no Centro, ideal para estadia profissional") **é o catálogo de exemplo atual** (`SAMPLE_PROPERTIES`, `src/lib/properties.ts`, ube-001 e ube-002), e já aparece na captura de QA `docs/capturas/qa-2026-11-08-0615/fixos-35-rotas.json`.
- O conjunto das 15h25 ("Apartamento no Santa Mônica — 1 quarto" R$ 3.800, "Quitinete no Centro" R$ 2.300) **não existe em nenhum commit do repositório** (`git log -S` nos dois títulos: vazio) **nem no banco de produção** (`properties`: só títulos de teste do Santa Mônica, nenhum com esses nomes).
- Logo, não é rotação, sorteio nem cache do mesmo build: as duas leituras vieram de **versões/ambientes diferentes** (por exemplo, URL de preview de outra branch ou de outro ambiente, ou HTML em cache de outro deploy). Na janela 17:30–19:30 UTC de 08/11 a Vercel só criou deploys de **preview** (`target: null`) de branches da Pista C e do QA; não houve promoção de produção ali.
- A instabilidade de **ordem** (sem desempate por id) era real e foi corrigida (#3561, guarda `e755-vitrine-estavel.test.ts`; spec de lab t1575 da Pista C). Para fechar o resto falta uma informação que só o QA tem: **a URL exata (host) das duas leituras** e a hora. Com ela, comparar o `dpl_` servido em cada uma.
