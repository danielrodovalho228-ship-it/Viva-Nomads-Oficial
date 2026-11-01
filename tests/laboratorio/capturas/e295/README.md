# E295 — caixa do vídeo da home a 390 px — captura arquivada

Capturas (390×844, escala 2, celular com toque, Chromium do laboratório, `origin/main` em f078e2a20, 01/11):

- `e295-video-home-390.png` — só a seção "A Viva em 30 segundos";
- `e295-video-home-390-tela.png` — a tela inteira com a caixa no meio, para ver a moldura dentro da página.

Veredito pela captura: **íntegro no celular.** A capa é o quadro do meio do vídeo ("Imóveis mobiliados"), não o cartão
final branco. O play verde com anel branco está no centro. Há o selo "0:33" no canto. A moldura cinza de 2 px tem os
cantos arredondados nos quatro lados, e nada vaza da tela.

| medida | valor |
| --- | --- |
| capa (`/media/institucional-poster.webp`) | decodifica, 1280×720 |
| caixa | 350 × 196,9 px, razão 1,778 (16:9), x de 20 a 370 |
| moldura | 2 px nos 4 lados, `rgb(221, 221, 221)`, raio 12 px |
| rolagem horizontal | nenhuma (scrollWidth 390) |
| play | 64 px, `rgb(28, 107, 58)`, centro em (175; 98,4) = meio da caixa |
| vídeo | parado, sem controles nativos antes do toque; nenhum mp4 baixado antes do play |

Teste permanente: `tests/e2e/specs/t882-e295-video-home-390.spec.ts`. O desktop já foi provado em 31/10 (t177/t730).
