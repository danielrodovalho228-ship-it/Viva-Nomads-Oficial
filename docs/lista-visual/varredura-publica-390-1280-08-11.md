# Varredura visual das páginas públicas a 390 e 1280 px (08/11/2026, Pista A)

**Base:** `main` em `a844024e7`, modo demonstração, sem prova ao vivo. 35 rotas públicas estáticas e de exemplo (home, buscar, comparar, favoritos, imóveis `ube-001/007/012`, cidades, ajuda, guias, parceiros, empresas, preços, segurança, privacidade, termos, pedidos…) × 2 larguras, rolando a página inteira.

**Verificações por tela:** imagem visível quebrada, estouro horizontal, elemento fixo cobrindo conteúdo ao fim da rolagem, texto cortado, fundo bege nas faixas de largura cheia, grade desalinhada (cartões da mesma fileira com topos diferentes).

**Resultado:** 0 imagens quebradas, 0 estouros horizontais, 0 fundos bege. Achados do script e leitura de cada um:

| # | Leitura do script | Conclusão |
|---|---|---|
| 1 | "Sem câmeras no interior (declarado pelo…" e "Urgente com solução provisória…" cortados em `/imoveis/*` a 390 e 1280 px | **E716**, já corrigido no #3356 (linha-resumo em até 2 linhas); medido com o #3356 aplicado: 0 cortes nas linhas-resumo |
| 2 | "Imóvel mobiliado e equipado" cortado em `/imoveis/ube-007` e `-012` a 1280 px | título de cartão de 2 linhas (`line-clamp-2`), desenho já registrado pela QA |
| 3 | "fixo cobrindo conteúdo" em `/`, `/buscar`, `/precos`, `/guias`, `/ajuda` e imóveis a 1280 px | **falso positivo**: o elemento fixo é o link "Pular para o conteúdo" (`skip-link`), parado fora da tela (topo −53 px). O botão flutuante "Fale com a Viva" (48 px) não cobre nenhum texto nem ação |
| 4 | "grade desalinhada" em várias rotas a 1280 px | **falso positivo do método** (cartões de fileiras vizinhas caem no mesmo balde de 40 px); a conferência visual das grades de `/`, `/buscar`, `/parceiros` e `/guias` não mostrou desalinho |
| 5 | `/ajuda/caucao` e `/guias/guia-de-fotos` com 404 | rotas que eu chutei; não existem |

**Defeitos novos confirmados:** nenhum. Não abri PR de correção. Soma-se à varredura do painel (`varredura-painel-390-1280-08-11.md`: 0 achados) e ao C19 (`/auth`, #3489).
