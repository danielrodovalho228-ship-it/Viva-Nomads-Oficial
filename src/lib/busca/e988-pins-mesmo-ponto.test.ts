/**
 * E988 (t840 a 390): no mapa do celular (350 × 591) 23 pins de R$ 3.200 caíam quase no mesmo ponto. O afastamento só
 * tentava 8 direções por anel; com elas ocupadas ou fora do mapa, o último pin ficava parado em cima de outro.
 * Roda: node --test src/lib/busca/e988-pins-mesmo-ponto.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { afastarPins, type CaixaPin } from "./pins-sem-sobreposicao.ts";

const caixas = (pins: CaixaPin[], d: Map<string, { dx: number; dy: number }>) =>
  pins.map((p) => {
    const o = d.get(p.id) ?? { dx: 0, dy: 0 };
    return { id: p.id, l: p.x + o.dx - p.w / 2, r: p.x + o.dx + p.w / 2, t: p.y + o.dy - p.h / 2, b: p.y + o.dy + p.h / 2 };
  });
const sobrepostos = (pins: CaixaPin[], d: Map<string, { dx: number; dy: number }>) => {
  const c = caixas(pins, d);
  const out: string[] = [];
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++) {
      const a = c[i], b = c[j];
      if (!(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)) out.push(`${a.id}×${b.id}`);
    }
  return out;
};
const quadro = { w: 350, h: 591 };
const pin = (id: string, x: number, y: number): CaixaPin => ({ id, x, y, w: 69, h: 24 });

// Os 23 centros medidos no laboratório (t840 a 390, main 2bbddc98a), na ordem em que o mapa os afasta.
const LAB_390 = [
  [162.5, 318], [162.5, 307], [174.5, 283], [186.5, 307], [174.5, 283], [186.5, 283], [197.5, 283], [151.5, 272],
  [186.5, 283], [197.5, 318], [151.5, 318], [174.5, 283], [151.5, 318], [174.5, 295], [151.5, 318], [186.5, 295],
  [186.5, 283], [162.5, 283], [151.5, 272], [186.5, 283], [174.5, 318], [197.5, 295], [186.5, 307],
] as const;

test("E988: os 23 pins de R$ 3.200 do laboratório (mapa do celular) — nenhum par se cobre e todos ficam no mapa", () => {
  const pins = LAB_390.map(([x, y], i) => pin(`p${i}`, x, y));
  const d = afastarPins(pins, quadro);
  assert.deepEqual(sobrepostos(pins, d), []);
  for (const c of caixas(pins, d)) assert.ok(c.l >= 0 && c.r <= quadro.w && c.t >= 0 && c.b <= quadro.h, `${c.id} dentro do mapa`);
});

test("E988: depois do zoom para longe (30 pins juntos, perto da borda) — nenhum par se cobre e todos ficam no mapa", () => {
  const pins = Array.from({ length: 30 }, (_, i) => pin(`z${i}`, 60 + (i % 3), 120 + (i % 2)));
  const d = afastarPins(pins, quadro);
  assert.deepEqual(sobrepostos(pins, d), []);
  for (const c of caixas(pins, d)) assert.ok(c.l >= 0 && c.r <= quadro.w && c.t >= 0 && c.b <= quadro.h, `${c.id} dentro do mapa`);
});

test("E988: os casos que já se resolviam nas 8 direções não mudam (o 2º pin vai logo abaixo do 1º)", () => {
  const pins = [pin("a", 175, 300), pin("b", 175, 300)];
  assert.deepEqual(afastarPins(pins, quadro).get("b"), { dx: 0, dy: 28 });
});
