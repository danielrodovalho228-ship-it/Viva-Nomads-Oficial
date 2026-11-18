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
