# E704 — pino de preço cobrindo o nome da cidade no mapa da busca (achado 12 da Allinne)

## O que mudou
- `afastarPins` ganhou o terceiro argumento `obstaculos` (caixas fixas na tela): o pin que cairia sobre um obstáculo vai para a posição livre mais próxima, e o obstáculo não se mexe. Sem obstáculos, o resultado é o de sempre (teste).
- **Mapbox:** o mapa lê os nomes de cidade que ele mesmo desenha (camadas `settlement-major-label` e `settlement-minor-label`, via `queryRenderedFeatures`) e os passa como obstáculos. A posição vem do mapa, não de palpite; a largura do texto é estimada pelo tamanho do nome. Reorganiza ao mover, redimensionar e quando o mapa termina de desenhar (`idle`). Sem a camada ou com erro, nenhum obstáculo.

## Limite desta entrega (leia antes de aprovar)
- **Não consegui ver o mapa aqui:** os tiles (Mapbox e CARTO) não carregam nesta sessão. O mecanismo está provado por testes puros, mas **a prova visual de que o pino sai de cima de "UBERLÂNDIA" precisa do mapa real** (QA do chat principal, 390 e 1280 px).
- **Mapa de reserva (Leaflet + CARTO, sem token):** o nome da cidade faz parte da imagem do mapa; não há dado de posição para ler. Nesse modo o ajuste não age. Se o QA da Allinne foi nesse modo, o próximo passo é trocar para os tiles `voyager_nolabels` com o nome da cidade desenhado pela página (decisão de desenho; peço confirmação antes).
