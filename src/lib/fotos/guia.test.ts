/* Roda: node --test src/lib/fotos/guia.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DICAS_FOTO, PARES_EXEMPLO, RODAPE_GUIA } from "./guia.ts";

const PROIBIDAS = /alugu|comiss|corretag|intermedia|vistori|apartamentos/i;

test("guia: dicas e rodapé sem termos proibidos", () => {
  for (const t of [...DICAS_FOTO, RODAPE_GUIA]) assert.doesNotMatch(t, PROIBIDAS);
  assert.equal(RODAPE_GUIA, "Plataforma em fase de testes. Lançamento oficial em 2027.");
});

test("guia: cobre as dicas pedidas e os pares sala/quarto", () => {
  const junto = DICAS_FOTO.join(" ").toLowerCase();
  for (const k of ["luz natural", "altura do peito", "horizontal", "vertical", "filtros", "fachada"]) assert.ok(junto.includes(k), k);
  assert.deepEqual(PARES_EXEMPLO.map((p) => p.ambiente), ["Sala", "Quarto"]);
  for (const p of PARES_EXEMPLO) assert.match(p.ruim + p.bom, /^\/guia-fotos\/.+\.webp\/guia-fotos\/.+\.webp$/);
});
