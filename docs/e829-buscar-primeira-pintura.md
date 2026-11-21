# E829 — /buscar pisca a lista completa antes de aplicar o filtro

**Achado:** abrindo um atalho da home (`?preco=2500`, `?pet=1`), a busca pintava primeiro os 15 anúncios SEM filtro e só depois caía para o resultado (1, 7).
**Causa no código:** `search-client.tsx` criava todo o estado vazio (`useState(0)`, `useState(false)`…) e só lia a URL num `useEffect` depois de montar (`restaurarFiltrosDaURL`). O HTML do servidor e o 1º desenho do cliente saíam sem filtro.

## Correção
1. **Leitura pura** `filtrosDaUrl(search)` (`src/lib/busca/filtros-da-url.ts`): a mesma regra de antes (aliases `orcamento`/`preco`, períodos legados, `?seguro=1` → seguro-fiança, valores inválidos = sem filtro), agora devolvendo o estado inteiro.
2. **`/buscar/page.tsx`** monta a query de `searchParams` e passa `buscaInicial` ao `SearchClient`.
3. **`SearchClient`**: todo `useState` nasce de `filtrosDaUrl(buscaInicial)`. Saiu o efeito que restaurava a URL no mount. O voltar/avançar (`popstate`) relê a URL pela mesma função.

**Mapa:** a coluna do mapa já é reservada por CSS desde 02/11 (`busca-lista` com `lg:w-[58%]` no 1º desenho; `busca-sem-salto.test.ts`), então ele não empurra a lista. O mapa aparecer à direita no computador é o desenho (pílula "Mapa" esconde). Não mexi.

## Testes
- `node --test src/lib/busca/e829-primeira-pintura-filtrada.test.ts`: main pass 0 / fail 1 (o módulo não existe); branch pass 3 / fail 0.
- Escopados: os 30+ arquivos que leem `search-client` + `src/lib/busca` + `/buscar` + e698/e454 → 0 falhas.
- **E2E** `tests/e2e/specs/t1630-e829-primeira-pintura-filtrada.spec.ts`: com o JavaScript DESLIGADO (só o HTML do servidor = a primeira pintura), a lista de `?preco=2500` e `?pet=1` é igual à final com JS e menor que a vitrine. Main (build da main no lab): FALHA. Para `?preco=2500`, o HTML do servidor traz 24 anúncios e o resultado final, 1 (`- Expected -1 / + Received +23`). Branch: verde, junto com t10, t7 e t71 (24 de 25 passaram).
- O t71 #5 ("salva e aparece em Buscas salvas") falha também num build da main, então não é deste PR.

## Asserções alteradas
Os testes que conferiam no texto do `search-client` que a URL é lida (`if (on("negocia")) setNegociaOnly(true)` etc.) passam a ler `search-client` + `filtros-da-url.ts`, com a forma nova (`negociaOnly: on("negocia")`):
`anuncio/chacara`, `busca/e439-aceita-negociacao`, `busca/e572-filtro-preco-justo`, `busca/e573-filtro-nivel`, `busca/e580-filtro-preco-justo-visivel`, `busca/facetas`, `busca/filtro-comodidades`, `home-busca-principal`, `nota-fiscal-textos`.
