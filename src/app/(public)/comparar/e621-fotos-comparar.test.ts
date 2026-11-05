/* Roda: node --test "src/app/(public)/comparar/e621-fotos-comparar.test.ts"
  E621 (prova ao vivo de 05/11): em /comparar a tabela vinha com as colunas dos imóveis SEM FOTO. Cada coluna abre com a
  foto principal do imóvel na proporção dos cartões do site (4:3, raio de 12 px) e leva ao anúncio; sem foto, o espaço
  reservado padrão (PhotoPlaceholder) — nunca uma coluna sem o bloco da foto.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const ini = s.indexOf('data-testid="comparar-coluna"');
const coluna = s.slice(ini, s.indexOf("Tirar da comparação", ini));

test("E621: cada coluna tem o bloco da foto 4:3 com raio de 12 px, antes do título", () => {
  assert.match(coluna, /data-testid="comparar-foto"/);
  assert.match(coluna, /aspect-\[4\/3\]/);
  assert.match(coluna, /rounded-xl/);
  assert.ok(coluna.indexOf('data-testid="comparar-foto"') < coluna.indexOf("{p.title}"), "a foto vem antes do título");
});

test("E621: foto principal quando há; sem foto, o espaço reservado padrão (nunca coluna sem o bloco)", () => {
  assert.match(coluna, /fotoPrincipal\(p\) \?/);
  assert.match(coluna, /<BrandImage/);
  assert.match(coluna, /<PhotoPlaceholder/);
  assert.match(s, /export function fotoPrincipal|function fotoPrincipal/);
});
