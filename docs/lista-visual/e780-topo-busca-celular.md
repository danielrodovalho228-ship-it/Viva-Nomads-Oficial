# E780 — topo da /buscar no celular (09/11/2026)

- **Reprodução (Chromium 390 px, local):** sem salto ao carregar (CLS vazio; chips e ações estáveis em 129/177 px). A deriva do print do Daniel é de rolagem: a faixa de filtros rolava junto com a página e o cabeçalho fixo (72 px) cobria a metade de cima dos chips; a fileira "Mais filtros · Ordenar · Mapa" subia junto. Há ainda uma faixa de 32 px acima do cabeçalho que sai da tela na primeira rolagem.
- **Causa:** nada na busca era fixo; o contêiner dos chips (`overflow-x-auto`) rolava com a página por baixo do cabeçalho.
- **Correção:** a faixa de filtros (`BarraPilulas`) fica num contêiner `sticky top-18 z-30 bg-white` (no computador, lg+, segue no fluxo); a contagem e a lista rolam por baixo dela. O painel aberto ganha altura máxima com rolagem própria (cabe na tela).
- **Prova local (390 px):** com a página rolada a 300, 900 e 2000 px, os chips ficam a 80 px e as ações a 128 px, inteiros e sem salto (`docs/capturas/e780/`).
- **Mockup:** os arquivos do mockup da busca (BUSCA-CARD) não estão no repositório; a comparação lado a lado com o mockup fica para o QA.
