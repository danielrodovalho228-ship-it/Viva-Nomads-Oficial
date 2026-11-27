# E810 — a busca muda entre carregamentos?

**Achado.** No RELATORIO-011 (12/11), as posições 4 a 15 da busca mudaram entre a primeira visita (12h24) e o
recarregamento (12h29), "inclusive o conjunto e os preços": Jardim Karaíba a R$ 3.800 numa visita e a R$ 5.620 na outra.

**Verificação.**
- A **segunda visita** (12h29, confirmada em dois carregamentos) é exatamente a vitrine do código: os 15 exemplos
  ube-001…ube-015, em ordem de id, com os preços do cartão certos (ex.: ube-008 Jardim Karaíba, 5.200 + 420 = R$ 5.620).
- A **primeira visita** lista bairros que **nunca existiram** na aplicação: São José, Martins, Laranjeiras, Santa Maria,
  Jardim das Palmeiras, Santa Luzia, Shopping Park e Tubalina, além de um "Jardim Karaíba a R$ 3.800".
  - Nenhum está em `src/` nem em nenhum commit do repositório (`git log --all -S'Tubalina'` e `-S'Shopping Park'`
    voltam vazios).
  - Nenhum está no banco de produção.
  - O preço do ube-008 é R$ 5.200 desde que o exemplo nasceu (01/10).
- É o mesmo padrão de leitura não literal já visto no RELATORIO-010 (E804, E806 e E808).

**Ordem da busca (código).** A ordem já era determinística: prioridade de completude (fotos + Preço justo) com desempate
por id (E755). Nenhum `Math.random`, nenhum relógio.

**O que entra.**
- A ordem de relevância vira a função pura `comparaRelevancia` (`src/lib/busca/ordem-estavel.ts`), usada por
  `search-client.tsx`. O comportamento não muda.
- Teste `src/lib/busca/e810-ordem-busca-estavel.test.ts`:
  1. 50 carregamentos com a lista embaralhada dão sempre a mesma vitrine (id, bairro, preço do cartão), igual à
     segunda visita do relatório.
  2. O conjunto é fixo: 15 exemplos e um só Jardim Karaíba, a R$ 5.620.
  3. A busca usa a função pura, e toda ordenação do cliente desempata por id, sem sorteio.
- Asserção alterada: `e755-vitrine-estavel.test.ts`, onde a contagem de `desempatePorId` passa a contar também
  `sort(comparaRelevancia)`.
