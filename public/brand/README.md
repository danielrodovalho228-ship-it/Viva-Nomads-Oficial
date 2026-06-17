# Arquivos de marca — Viva Nomads

O logo é renderizado como **vetor** no componente `src/components/ui/logo.tsx`
(símbolo "N" com estrada + wordmark). `symbol.svg` aqui é a versão canônica do símbolo.

## Para usar os arquivos OFICIAIS (pixel-perfect)

1. Coloque os arquivos oficiais nesta pasta com estes nomes:
   - `symbol.svg` (ou `symbol.png`) — o monograma "N" com estrada.
   - `wordmark.svg` (ou `wordmark.png`) — o texto "VivaNomads".
   - `wordmark-light.svg` — versão para fundo escuro (se houver).
2. Avise o time/dev — o componente `Logo` passa a usar `<Image>` apontando para
   estes arquivos, substituindo a versão vetorial.

> Enquanto não houver os oficiais, a versão vetorial (cores #1E63D0 + #6CBE2A)
> é usada em header, footer, favicon e Open Graph.
