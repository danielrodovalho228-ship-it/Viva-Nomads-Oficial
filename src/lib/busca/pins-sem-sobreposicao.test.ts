/** E525 (D11) — pins do mapa sem sobreposição e título do cartão sem "…" à toa — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afastarPins, type CaixaPin } from "./pins-sem-sobreposicao.ts";

const pin = (id: string, x: number, y: number): CaixaPin => ({ id, x, y, w: 64, h: 24 });
const caixas = (pins: CaixaPin[], d: Map<string, { dx: number; dy: number }>) =>
  pins.map((p) => {
    const o = d.get(p.id) ?? { dx: 0, dy: 0 };
    return { id: p.id, l: p.x + o.dx - p.w / 2, r: p.x + o.dx + p.w / 2, t: p.y + o.dy - p.h / 2, b: p.y + o.dy + p.h / 2 };
  });
const sobrepostos = (pins: CaixaPin[], d: Map<string, { dx: number; dy: number }>) => {
  const c = caixas(pins, d);
  const out: string[] = [];
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const a = c[i], b = c[j];
    if (!(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)) out.push(`${a.id}×${b.id}`);
  }
  return out;
};

test("pins que não se tocam ficam onde estão", () => {
  const pins = [pin("a", 0, 0), pin("b", 200, 0), pin("c", 0, 200)];
  const d = afastarPins(pins);
  for (const p of pins) assert.deepEqual(d.get(p.id), { dx: 0, dy: 0 }, p.id);
});

test("D11: R$ 2.430 em cima do R$ 4.420 (mesmo ponto) — o segundo sai de baixo do primeiro", () => {
  const pins = [pin("4420", 100, 100), pin("2430", 104, 102)];
  assert.deepEqual(sobrepostos(pins, afastarPins(pins)), []);
  assert.deepEqual(afastarPins(pins).get("4420"), { dx: 0, dy: 0 }, "o primeiro fica no lugar");
});

test("D11: aglomerado (3.130 / 3.470 / 3.320 e vizinhos) — nenhum par se cobre e ninguém vai longe", () => {
  const pins = [pin("3130", 300, 300), pin("3470", 310, 305), pin("3320", 295, 310), pin("3020", 305, 300), pin("2670", 300, 296), pin("2430", 312, 298)];
  const d = afastarPins(pins);
  assert.deepEqual(sobrepostos(pins, d), []);
  for (const [id, o] of d) assert.ok(Math.hypot(o.dx, o.dy) <= 6 * 28, `${id} ficou perto do ponto (${o.dx}, ${o.dy})`);
});

test("390: o pin afastado não sai do mapa (o R$ 2.830 ia para x = −24, fora da tela)", () => {
  // Faixa baixa do mapa: abaixo e à esquerda do pin "b" só há espaço FORA do quadro; acima e à direita, outros pins.
  const quadro = { w: 350, h: 80 };
  const pins = [pin("a", 40, 50), pin("c", 108, 50), pin("b", 42, 52)];
  const d = afastarPins(pins, quadro);
  assert.deepEqual(sobrepostos(pins, d), []);
  for (const c of caixas(pins, d)) assert.ok(c.l >= 0 && c.r <= quadro.w && c.t >= 0 && c.b <= quadro.h, `${c.id} dentro do mapa`);
});

test("lab (390): 20 pins no MESMO ponto, num mapa de celular — nenhum par se cobre e todos ficam no mapa", () => {
  const quadro = { w: 350, h: 591 };
  const pins = Array.from({ length: 20 }, (_, i) => pin(`p${i}`, 175, 300));
  const d = afastarPins(pins, quadro);
  assert.deepEqual(sobrepostos(pins, d), []);
  for (const c of caixas(pins, d)) assert.ok(c.l >= 0 && c.r <= quadro.w && c.t >= 0 && c.b <= quadro.h, `${c.id} dentro do mapa`);
});

test("pin de tamanho zero (mapa ainda escondido no celular) não conta: a fiação refaz o afastamento quando o mapa aparece", () => {
  const src = readFileSync(new URL("../../components/search-map.tsx", import.meta.url), "utf8");
  // o ResizeObserver do Leaflet (mapa que aparece ao tocar em "Mapa") também reorganiza os pins
  assert.match(src, /reorganizarRef\.current\?\.\(\)/);
});

test("é estável: a mesma entrada dá a mesma saída (os pins não pulam a cada redesenho)", () => {
  const pins = [pin("a", 10, 10), pin("b", 12, 11), pin("c", 14, 9)];
  assert.deepEqual([...afastarPins(pins)], [...afastarPins(pins)]);
});

test("os dois motores aplicam o afastamento (por margem, sem brigar com o translate do pin) ao mover e ao dar zoom", () => {
  const src = readFileSync(new URL("../../components/search-map.tsx", import.meta.url), "utf8");
  assert.equal(src.match(/aplicarAfastamento\(/g)?.length, 3, "a função e os dois motores");
  assert.match(src, /el\.style\.marginLeft = `\$\{dx\}px`/);
  assert.match(src, /map\.on\("zoomend moveend", reorganizar\)/);
  assert.match(src, /map\.on\("moveend resize", reorganizar\)/);
});

test("título do cartão do mapa: até 2 linhas e o nome inteiro no title (antes cortava sempre com '…')", () => {
  const card = readFileSync(new URL("../../components/busca/card-pin-mapa.tsx", import.meta.url), "utf8");
  assert.match(card, /<p className="line-clamp-2 text-sm font-semibold text-ink" title=\{p\.title\}>\{p\.title\}<\/p>/);
  assert.doesNotMatch(card, /line-clamp-1 text-sm font-semibold/);
});
