# E704 — pino de preço cobrindo o nome da cidade no mapa da busca (achado 12 da Allinne)

## O que mudou
- `afastarPins` ganhou o terceiro argumento `obstaculos` (caixas fixas na tela): o pin que cairia sobre um obstáculo vai para a posição livre mais próxima, e o obstáculo não se mexe. Sem obstáculos, o resultado é o de sempre (teste).
- **Mapbox:** o mapa lê os nomes de cidade que ele mesmo desenha (camadas `settlement-major-label` e `settlement-minor-label`, via `queryRenderedFeatures`) e os passa como obstáculos. A posição vem do mapa, não de palpite; a largura do texto é estimada pelo tamanho do nome. Reorganiza ao mover, redimensionar e quando o mapa termina de desenhar (`idle`). Sem a camada ou com erro, nenhum obstáculo.

## Limite desta entrega (leia antes de aprovar)
- **Não consegui ver o mapa aqui:** os tiles (Mapbox e CARTO) não carregam nesta sessão. O mecanismo está provado por testes puros, mas **a prova visual de que o pino sai de cima de "UBERLÂNDIA" precisa do mapa real** (QA do chat principal, 390 e 1280 px).
- **Mapa de reserva (Leaflet + CARTO, sem token):** o nome da cidade faz parte da imagem do mapa; não há dado de posição para ler. Nesse modo o ajuste não age. Se o QA da Allinne foi nesse modo, o próximo passo é trocar para os tiles `voyager_nolabels` com o nome da cidade desenhado pela página (decisão de desenho; peço confirmação antes).

## Segunda parte (mapa de reserva, Leaflet + CARTO) — o que roda em produção
A QA de 07/11 mostrou que a produção roda **Leaflet + CARTO** (sem token do Mapbox) e que o rótulo "NOSSA SENHORA APARECIDA" seguia coberto pelo pino R$ 3.340: a correção do #3291 só agia no Mapbox, e uma versão que só protegia o ponto de "Uberlândia" não cobriria nomes de bairro. Caminho adotado (o sugerido no #3291):
- A busca usa os tiles **`voyager_nolabels`** (`TILES_CARTO_SEM_ROTULOS`, mesma chave). Nenhum nome vem mais desenhado no tile, então **nenhum rótulo de tile pode ficar coberto**.
- A página desenha o nome da cidade ("Uberlândia") como marcador sem interação, **com o retângulo que ela mesma define** (`caixaDoRotulo`); o mesmo retângulo é o obstáculo do `afastarPins`. A posição não é palpite. Do zoom 15 em diante o nome some e deixa de ser obstáculo.
- O mapa do imóvel e o de marcar ponto seguem com os tiles de sempre.
- **Custo de desenho (decisão já indicada no #3291):** somem do mapa da busca os nomes de bairros, ruas e cidades vizinhas. O mapa continua mostrando relevo, vias e quadras; só o nome da cidade é escrito.
- **Limite:** não vi o mapa (tiles do CARTO bloqueados nesta rede); a prova visual a 1280 e 390 px, com os pinos R$ 2.430, R$ 3.470, R$ 3.340 e R$ 4.420, é do QA. Se faltar nome de bairro para a orientação, o passo seguinte é desenhar também os bairros que têm imóvel, com coordenada própria (nova lista em `CIDADES_ROTULADAS`).
