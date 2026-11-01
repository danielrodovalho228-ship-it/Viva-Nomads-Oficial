# E313 — lista-resumo de comodidades a 390 px (ube-001) — captura arquivada

Captura: `e313-lista-resumo-ube-001-390.png` (390×844, escala 2, Chromium do laboratório, `origin/main` em f078e2a20, 01/11).

Veredito pela captura: **há item órfão (19 itens, número ímpar), e ele fica na 1ª coluna, alinhado à esquerda — não centrado.**
O 19º item, "Interfone", ocupa sozinho a última linha, colado à esquerda sob "Vaga de garagem"; a 2ª coluna fica vazia nessa linha.
Isso desfaz a contradição dos retornos anteriores: nem "linha cheia sem órfão" (a lista é ímpar) nem "Interfone centrado" (está na 1ª coluna).

Medidas na mesma página (`[data-testid=comodidades] ul.grid-cols-2`):

| medida | valor |
| --- | --- |
| largura da grade | 358 px |
| itens | 19 (ímpar) |
| largura de cada item | 171 px |
| colunas (dx) | 0 / 187 alternados |
| último item | "Interfone", dx = 0, ícone dx = 0 |
| alinhamento | `text-align: start`, `justify-content: flex-start` |
| bloco "Não tem" | 1 item ("Lava-louças"), dx = 0 |

Teste permanente: `tests/e2e/specs/t765-e313-ultimo-item-primeira-coluna.spec.ts` (já na main) confere a mesma regra a 390 e 1280.
