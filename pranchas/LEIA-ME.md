# Pranchas do pacote visual do E744 (corridas locais de 16/11/2026)

**Ramo só de evidência: não tem PR e não é para mesclar.** O julgamento proposto está no PR #3894
(`docs/e744-pacote-visual-julgamento.md`).

Cada prancha traz, lado a lado: ESPERADO (a referência versionada) | OBTIDO (a corrida) | DIFERENÇA (a do Playwright;
falta quando a imagem mudou de tamanho). O `indice.md` traz a medida de cada tela.

- **O que correu:** t245, t263 e t271 no laboratório local, banco recém-semeado, produto da main `29b54ddd` (build de
  `49efe073`; entre os dois a main não mudou produto). Duas corridas: `53 failed · 5 did not run · 5 passed` nas duas.
  As pranchas são da segunda.
- **t263 06–08:** cada tela correu sozinha, com a contagem dos itens da folha ajustada só nessas corridas (4/4/5,
  E539 iv), para a imagem existir. O spec não foi alterado em nenhum commit.
- **Limite:** Chromium e fontes do laboratório local, não os do GitHub. Serve para ler a estrutura das diferenças; a
  rodada oficial é a do `lab-diffs` (#3852).
- As imagens são JPEG (qualidade 82) para o ramo pesar pouco: 58 pranchas, 5 MB.
