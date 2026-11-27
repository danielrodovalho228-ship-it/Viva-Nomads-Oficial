# E780 reaberto — barra de filtros da /buscar íntegra a 390 px (14/11/2026)

**Relato.** No print do Daniel (14/11, 09:48), a 390 px, o primeiro chip saía cortado na borda esquerda e havia uma barra de rolagem visível sob os chips. O item tinha sido fechado em 09/11 sem prova real a 390 px.

**Causa.** No celular, a fileira de filtros (`pilulas-filtros`, em `src/components/busca/barra-pilulas.tsx`) era `-mx-4 overflow-x-auto px-4`: uma faixa que rolava de lado, invadia a margem da página e escondia os chips seguintes. Na main, a 390 px, o chip "Preço" terminava em x = 411, fora da tela. Bastava rolar a faixa para o primeiro chip passar sob a borda, e a barra de rolagem aparecia.

**Correção.** No celular, a fileira quebra linha: `flex flex-wrap`, sem `overflow-x`, sem margem negativa.
- Os cinco filtros (Datas · Local · Tipo · Preço · Nível) ficam inteiros, dentro da margem de 16 px.
- As ações (Mais filtros · Ordenar · Mapa) continuam na linha própria (E710).
- Do tablet para cima (`sm:`) segue uma linha só, como antes.
- A faixa continua presa abaixo do cabeçalho ao rolar (E780 de 09/11).

**Deslocamento ao carregar.** Dois ajustes da própria busca acontecem depois que a página abre, e nenhum empurra outro chip nem muda a altura da barra:
- **O valor vindo da URL.** A busca restaura os filtros da URL no navegador, então o chip passa de "Tipo" para "Apartamento".
- **A pílula "Nível" (E452).** Ela surge no fim da fileira quando os exemplos ou imóveis chegam.

O T1627 confere que nenhum chip muda de x/y e que a altura da barra é a mesma. Só a pílula Nível pode surgir.

**Testes.**
- `src/components/busca/e780-barra-integra.test.ts`: na main `# pass 1 / # fail 3`; na branch `# pass 4 / # fail 0`.
- `tests/e2e/specs/t1627-e780-barra-filtros-integra.spec.ts`, a 390 px, sem filtros e com filtros ligados:
  - chips inteiros desde o primeiro;
  - fileiras sem sobra lateral, sem overflow-x rolável e sem barra reservada;
  - página sem rolagem lateral;
  - sem deslocamento ao carregar nem ao rolar.

  Na main falha com `pilula-preco termina dentro da margem da página (fim=411)`. Na branch: 2 passed.

**Mockup.** Os arquivos do mockup da busca não estão no repositório, como já registrado no E780 de 09/11. A comparação lado a lado fica com o QA.

**Prints (lab, 390 px).**
- `docs/e780/antes-390.png`: main, a fileira rola e "Preço" passa da borda.
- `docs/e780/depois-390.png`: branch.
