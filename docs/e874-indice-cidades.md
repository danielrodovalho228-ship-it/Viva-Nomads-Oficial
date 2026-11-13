# E874 — não existia índice de cidades; /cidades/sao-paulo dava 404 seco

**Achado (RELATORIO-021, A-107/A-108):** /cidades redirecionava (308) para /cidades/uberlandia; /cidades/sao-paulo devolvia 404.

## Correção
- `src/lib/indice-cidades.ts` (puro):
  - `linhaIndiceCidade` faz o rótulo "N imóveis" / "Sem imóveis no momento" e o mesmo detalhe reais × exemplo da página da cidade;
  - `slugDaCidade` e `municipiosDoSlug` reconhecem o slug na lista do IBGE (homônimos voltam todos).
- **/cidades** é o índice: cada cidade de `CITIES` com a contagem pela MESMA base da página dela (`baseDaVitrine(listPropertiesByCity)`), e o cartão leva a ela. Embaixo, "Sua cidade ainda não está aqui?" → pedido de moradia.
- **/cidades/[cidade]** de um município real sem operação (ex.: `sao-paulo`): página "Ainda não operamos em São Paulo" (status 200, `noindex`), com "Publicar pedido de moradia" (`/pedidos/novo?cidade=São Paulo`) e "Ver cidades onde já operamos". Slug que não é município (`xpto123`) segue 404.
- O sitemap não mudou: /cidades fica fora, como o t20 exige.

## Testes
- `node --test src/lib/e874-indice-cidades.test.ts`: main pass 0 / fail 1; branch pass 3 / fail 0.
- E2E `tests/e2e/specs/t1631-e874-indice-cidades.spec.ts`:
  - /cidades responde 200 sem redirecionar; Uberlândia tem a mesma contagem no índice e na página dela;
  - /cidades/sao-paulo: 200, h1 certo, links e noindex;
  - /cidades/xpto123: 404.
- Lab (build da branch): t1631 + t176 + t20 + t117 → 20 passed, 3 failed. As falhas são em telas que este PR não toca: o botão "Enviar mensagem" do anúncio ube-001 (t176, 2 larguras) e /conferir com código válido (t20).
- Escopados: 0 falhas. tsc limpo; consistência OK.

## Asserções alteradas
- `src/lib/paginas-publicas-seo.test.ts` (#36): /cidades deixa de redirecionar e passa a ser o índice.
