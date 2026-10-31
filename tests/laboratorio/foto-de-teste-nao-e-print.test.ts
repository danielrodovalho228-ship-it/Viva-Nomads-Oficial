import test from "node:test";
import assert from "node:assert/strict";
import { medirTela, pareceTela } from "../../src/lib/fotos/conteudo.ts";
import { rasterDeTeste } from "../e2e/fixtures/raster-foto.ts";

/*
  t204 (lab 31/10, 3 labs seguidos): as fotos geradas pelo laboratório eram duas faixas chapadas e a regra local de
  "print de tela" (conteudo.ts) passou a barrá-las: sem capa e sem IA. A foto de teste tem de parecer foto.
*/
function reduzir(rgb: Uint8Array, w: number, h: number, alvoW: number) {
  const f = Math.floor(w / alvoW);
  const nw = Math.floor(w / f);
  const nh = Math.floor(h / f);
  const out = new Uint8Array(nw * nh * 3);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += rgb[((y * f + dy) * w + x * f + dx) * 3 + c];
        out[(y * nw + x) * 3 + c] = Math.round(s / (f * f));
      }
  return { out, nw, nh };
}

test("a foto de teste do laboratório não é lida como print de tela", () => {
  for (const n of [1, 2, 7, 8, 28, 48, 255]) {
    const { rgb, w, h } = rasterDeTeste(n);
    const r = reduzir(rgb, w, h, 256);
    const m = medirTela(r.out, r.nw, r.nh);
    assert.equal(pareceTela(m), false, `n=${n}: ${JSON.stringify(m)}`);
  }
});

test("fotos de teste diferentes continuam diferentes entre si", () => {
  const a = Buffer.from(rasterDeTeste(1).rgb);
  const b = Buffer.from(rasterDeTeste(2).rgb);
  assert.notEqual(a.compare(b), 0);
});
