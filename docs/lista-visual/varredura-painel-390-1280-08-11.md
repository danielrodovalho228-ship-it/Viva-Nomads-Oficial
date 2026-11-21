# Varredura visual do painel a 390 e 1280 px (08/11/2026, Pista A)

**Base:** `main` + o branch do E720 (#3455), modo demonstração, sem prova ao vivo. 43 rotas estáticas do `/dashboard` (menos `/dashboard/qa`, que são páginas de teste, e as que dependem de id) × 2 larguras, rolando a página inteira.

**Verificações por tela:** imagem visível quebrada (carregou e ficou com largura 0), estouro horizontal da página, elemento fixo cobrindo conteúdo (texto, botão ou campo) ao fim da rolagem, texto cortado (reticências ou `overflow: hidden` com texto maior que a caixa).

**Resultado:** 85 de 86 leituras sem nenhum achado; **0 imagens quebradas, 0 estouros horizontais, 0 elementos fixos cobrindo conteúdo, 0 textos cortados**, nas duas larguras. A leitura restante (`/dashboard/conta` a 1280 px) foi interrompida porque a rota redireciona para `/dashboard/conta/perfil` no computador; o Perfil foi lido e está limpo.

**Notas do método:**
- Uma primeira rodada marcou "fixo sobrepondo" em quase toda tela a 390 px. Era falso positivo (conteúdo que normalmente rola por baixo da barra de abas). A rodada válida só conta o que fica coberto ao fim da rolagem, quando o espaçador da barra deve ter liberado o conteúdo.
- A varredura do botão flutuante (E709) cobriu só `/imoveis/ube-001` e `/para-proprietarios` a 1280 px (0 conflitos); esta cobre o painel.
- `/dashboard/avaliacoes` redireciona o demo ao login (precisa de dados reais): fica para o QA com conta real.

**Defeitos confirmados:** nenhum. Por isso não abri PR de correção.
