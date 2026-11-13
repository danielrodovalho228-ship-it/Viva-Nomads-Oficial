# E875 — bairro sem imóvel na grade da cidade, sem explicação nem caminho

**Achado (RELATORIO-021, A-112):** "Martins — Sem imóveis no momento" na lista de bairros de Uberlândia, sem dizer o que fazer.
**Conferido no código:**
- O Martins é bairro curado (`src/lib/bairros.ts`, lista de Uberlândia). A grade mostra os curados mesmo sem anúncio, ordenados por total, então os vazios vão para o fim.
- O cartão já levava à página do bairro, e ela tem estado vazio com "Avise-me quando houver" e "Veja também" (bairros vizinhos com imóveis). O cartão só não dizia isso.

## Correção
`textoBairroNaGrade(total)` (`src/lib/bairros.ts`), usado pela grade da página da cidade:
- com imóveis: "N imóveis";
- sem imóveis: "Sem imóveis no momento" + **"Avise-me quando houver e veja os bairros vizinhos"** (`data-testid="bairro-cartao-dica"`), no padrão da página (texto verde de ação, o cartão inteiro é o link).

## Testes
- `node --test src/lib/e875-bairro-vazio.test.ts`: main pass 0 / fail 1; branch pass 3 / fail 0.
- Escopados (bairros, e446, grade par, estilo): 45 / 0. tsc limpo; consistência OK.
- Lab (build da branch): o HTML de /cidades/uberlandia traz no cartão do Martins "Sem imóveis no momento" + a dica.
