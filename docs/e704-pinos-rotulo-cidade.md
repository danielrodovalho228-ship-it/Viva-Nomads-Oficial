# E704 — pino de preço cobrindo o nome da cidade no mapa da busca (achado 12 da Allinne)

## O que mudou
- `afastarPins` ganhou o terceiro argumento `obstaculos` (caixas fixas na tela): o pin que cairia sobre um obstáculo vai para a posição livre mais próxima, e o obstáculo não se mexe. Sem obstáculos, o resultado é o de sempre (teste).
- **Mapbox:** o mapa lê os nomes de cidade que ele mesmo desenha (camadas `settlement-major-label` e `settlement-minor-label`, via `queryRenderedFeatures`) e os passa como obstáculos. A posição vem do mapa, não de palpite; a largura do texto é estimada pelo tamanho do nome. Reorganiza ao mover, redimensionar e quando o mapa termina de desenhar (`idle`). Sem a camada ou com erro, nenhum obstáculo.

## Limite desta entrega (leia antes de aprovar)
- **Não consegui ver o mapa aqui:** os tiles (Mapbox e CARTO) não carregam nesta sessão. O mecanismo está provado por testes puros, mas **a prova visual de que o pino sai de cima de "UBERLÂNDIA" precisa do mapa real** (QA do chat principal, 390 e 1280 px).
- **Mapa de reserva (Leaflet + CARTO, sem token):** o nome da cidade faz parte da imagem do mapa; não há dado de posição para ler. Nesse modo o ajuste não age. Se o QA da Allinne foi nesse modo, o próximo passo é trocar para os tiles `voyager_nolabels` com o nome da cidade desenhado pela página (decisão de desenho; peço confirmação antes).

## Segunda parte (mapa de reserva, Leaflet + CARTO) — a que roda em produção
A QA de 07/11 (23:05) mostrou que a produção roda **Leaflet + CARTO** (sem token do Mapbox): a correção do #3291 só agia no Mapbox. Agora o mapa Leaflet também desvia: `src/lib/busca/rotulos-cidade-leaflet.ts` projeta o ponto da cidade (onde o tile escreve "Uberlândia") e o passa como obstáculo fixo ao `afastarPins`; reorganiza em `zoomend` e `moveend`.
- **Sem troca de tiles** (nenhuma decisão de desenho): os nomes de bairros e ruas do mapa seguem como estão.
- **Limite (leia):** é uma caixa estimada sobre o ponto da cidade (≥ 100 × 26 px, cresce com o nome), não a posição lida do desenho; o tile aumenta o texto com o zoom e só a cidade listada é protegida. Não vi o mapa (os tiles do CARTO não carregam nesta rede): a prova visual com os pinos R$ 2.430, R$ 3.470 e R$ 4.420 é do QA, a 1280 e 390 px. Se a caixa errar o lugar, o ajuste é o ponto/tamanho em `CIDADES_ROTULADAS`; o caminho robusto continua sendo `voyager_nolabels` com o nome desenhado pela página (decisão do Daniel).
