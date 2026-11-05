/**
 * E442 (regressão, prioridade alta): passar o mouse no PREÇO do mapa da busca abre o cartão do imóvel (o mesmo do
 * clique: foto, título, valor/mês e clique para o anúncio). O hover se perdeu na ordem ca0e7dad (14/10, commit
 * 41b55043d), que trocou o mini-card do hover por "hover só destaca"; sobrava a etiqueta nativa (title) do Leaflet.
 * Guardas permanentes nos DOIS mapas (Mapbox e Leaflet). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapa = readFileSync(new URL("../search-map.tsx", import.meta.url), "utf8");
const mapbox = mapa.slice(mapa.indexOf("function SearchMapbox"), mapa.indexOf("function SearchMapLeaflet"));
const leaflet = mapa.slice(mapa.indexOf("function SearchMapLeaflet"));

for (const [nome, m] of [["Mapbox", mapbox], ["Leaflet", leaflet]] as const) {
  test(`${nome}: o hover no preço abre a prévia e o cartão aberto é o do clique OU o da prévia`, () => {
    assert.match(m, /const previa = usePreviaNoHover\(\);/);
    assert.match(m, /addEventListener\("mouseenter", \(\) => \{\s*onHoverRef\.current\(p\.id\);\s*previaRef\.current\.entrarPin\(p\.id\);/);
    assert.match(m, /addEventListener\("mouseleave", \(\) => \{\s*onHoverRef\.current\(null\);\s*previaRef\.current\.sair\(\);/);
    assert.match(m, /const abertoId = selectedId \?\? previa\.id;/);
    assert.match(m, /\}, \[abertoId, sig, popupEl\]\);/);
    assert.match(m, /popupEl\.addEventListener\("mouseenter", previa\.manter\)/);
    assert.match(m, /<CardPinMapa property=\{aberto\} onFechar=\{fechar\} \/>/);
  });
}

test("Leaflet: sem a etiqueta nativa (title) no pin", () => {
  assert.doesNotMatch(leaflet, /L\.marker\(\[p\.lat, p\.lng\], \{ icon, title: p\.title/);
});

test("a prévia só abre com mouse e fecha com folga para chegar ao cartão", () => {
  const h = readFileSync(new URL("./previa-hover.ts", import.meta.url), "utf8");
  assert.match(h, /matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(h, /export const ESPERA_PREVIA_MS = 250;/);
});
