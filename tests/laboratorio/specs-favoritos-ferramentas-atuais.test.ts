import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab d63d1acd: t160 (link "Favoritos" no topo público) e t266 (5 telas do painel pela gaveta "Abrir menu") esperavam
// telas anteriores ao E176 (PUBLICO-A) e ao MENUS-5. Este teste prende as duas specs ao código atual.
const ler = (f: string) => readFileSync(f, "utf8");
const spec = (f: string) => ler(`tests/e2e/specs/${f}`);

test("t160: o topo público não tem Favoritos, então a spec não cobra o link", () => {
  const nav = ler("src/lib/constants.ts").match(/export const PUBLIC_NAV = \[([\s\S]*?)\]/)?.[1] ?? "";
  assert.deepEqual([...nav.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Imóveis", "Anunciar", "Empresas"]);
  const t160 = spec("t160-favoritos-pagina.spec.ts");
  assert.doesNotMatch(t160, /const link = page\.getByRole\("link", \{ name: \/Favoritos\/ \}\)/);
  assert.match(t160, /getByRole\("link", \{ name: \/Favoritos\/ \}\)\)\.toHaveCount\(0\)/);
});
