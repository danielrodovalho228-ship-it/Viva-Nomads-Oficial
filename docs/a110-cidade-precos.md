# A-110 (RELATORIO-021) — FAQ da cidade manda para "Preços", que está suspensa

**Achado (Phoenix, 13/11):** em /cidades/uberlandia, "Quanto custa anunciar?" termina com "Veja os detalhes em Preços."; /precos serve a home (E563, `PRECOS_VISIVEL` desligada).
**Conferido no código:** `perguntasCidade` (`src/lib/seo/anuncio-cidade.ts`) tinha o texto fixo; a mesma lista alimenta a tela e o FAQPage (JSON-LD).

**Correção:** `perguntasCidade(cidade, precosVisivel = PRECOS_VISIVEL)`. Desligada → "Veja os detalhes em Para proprietários." (a página tem a taxa: 12% → 6%, Gestor 4%). Ligada → volta a "Preços", sem retrabalho.

**Teste:** `node --test src/lib/seo/a110-cidade-precos.test.ts` — main: pass 1 / fail 2; branch: pass 3 / fail 0. Escopados (a110 + anuncio-cidade + e101 + e563): pass 20 / fail 0. tsc limpo; consistência OK.

**Fora deste PR (do mesmo relatório):** A-115 (concordância "são mobiliado") vai em PR próprio. A-112 (bairro "Sem imóveis no momento") e A-114 ("qualificados" sem critério) ficam para o Gerente registrar.
