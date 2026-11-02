/*
  Frente 1, rodada 1 — achado 117 (média-alta): "Usar as fotos no anúncio" (entrega do fotógrafo parceiro) lia o
  imóvel, as entregas e as fotos atuais sem conferir o erro. Sem as fotos atuais: as da entrega entravam em dobro e
  com sort_order a partir de 0 (passando à frente da foto principal); sem as entregas: "A entrega não tem fotos".
  Agora qualquer leitura que falha recusa com "Tente de novo", antes de copiar qualquer arquivo.
  Roda: node --test src/lib/parceiros/achado117-fotos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./pedido-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function usarFotosNoAnuncio"), src.indexOf("export async function avaliarPedido"));

test("usar as fotos no anúncio: as três leituras recusam na falha, antes de copiar qualquer foto", () => {
  for (const e of ["e1", "e2", "e3"]) assert.match(fn, new RegExp(`if \\(${e}\\) return \\{ ok: false, erro: MSG_FOTOS_SEM_LEITURA \\};`), e);
  const ultimaGuarda = fn.indexOf("if (e3)");
  assert.ok(ultimaGuarda > 0 && ultimaGuarda < fn.indexOf(".download(img.path)"), "as guardas vêm antes do primeiro download");
});
