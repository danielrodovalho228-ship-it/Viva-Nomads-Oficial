/* Passada de celular (31/10): alvos de toque de 44 px no celular — links do rodapé, ícone do Instagram, Compartilhar do
   imóvel e o + / − do mapa. No computador o rodapé fica como era. Roda: node --test src/lib/estilo/alvo-toque-celular.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("rodapé: link de 44 px no celular, como era no computador", () => {
  const r = ler("components/layout/footer.tsx");
  assert.match(r, /<Link href=\{href\} className="inline-flex min-h-11 items-center [^"]*md:inline md:min-h-0">/);
  assert.match(r, /<ul className="text-sm md:space-y-3">/);
});

test("Instagram, Compartilhar e o zoom do mapa com 44 px", () => {
  assert.match(ler("components/layout/redes-oficiais.tsx"), /inline-flex min-h-11 min-w-11 items-center/);
  assert.match(ler("components/share-button.tsx"), /"grid h-11 w-11 place-items-center rounded-full/);
  assert.match(ler("app/globals.css"), /\.leaflet-container\.leaflet-touch \.leaflet-bar a\.leaflet-control-zoom-in[\s\S]*?width: 44px;\s*height: 44px;/);
});
