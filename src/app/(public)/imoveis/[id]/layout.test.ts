import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** t176: imóvel inexistente = 404 de verdade, não 200 com a tela de "não encontrada" (loading.tsx abre o stream). */
test("o layout do imóvel checa a existência antes do loading.tsx e usa a consulta em cache", () => {
  const layout = readFileSync("src/app/(public)/imoveis/[id]/layout.tsx", "utf8");
  assert.match(layout, /getProperty\(id\)/);
  assert.match(layout, /notFound\(\)/);
  const dados = readFileSync("src/lib/data/properties.ts", "utf8");
  assert.match(dados, /export const getProperty = cache\(/);
});
