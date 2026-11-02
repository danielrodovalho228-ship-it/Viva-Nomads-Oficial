import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: editar o anúncio com leitura falha nunca apaga a chácara nem reavisa os pedidos. */
const fonte = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const i = fonte.indexOf("export async function updateProperty(");
const f = fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);

test("updateProperty: estado anterior ilegível para antes de qualquer gravação", () => {
  assert.ok(i >= 0);
  const g = f.indexOf("if (erroAntes) return { ok: false");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("await sincronizarFotos("), "antes das fotos");
  assert.ok(g < f.indexOf('.from("properties")\n    .update('), "antes do update principal");
});

test("updateProperty: detalhes ilegíveis não regravam a coluna (a chácara fica)", () => {
  const g = f.indexOf("if (erroDet) throw");
  assert.ok(g >= 0);
  assert.ok(g < f.indexOf("update({ detalhes_anuncio:"), "antes de regravar os detalhes");
});
