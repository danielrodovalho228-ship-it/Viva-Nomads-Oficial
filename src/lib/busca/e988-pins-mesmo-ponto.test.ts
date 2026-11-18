/**
 * E988 (t840 a 390): no mapa do celular (350 × 591) 23 pins de R$ 3.200 caíam quase no mesmo ponto. O afastamento só
 * tentava 8 direções por anel; com elas ocupadas ou fora do mapa, o último pin ficava parado em cima de outro.
 * Decisão do Gerente (DUET-0649): "pins no mesmo ponto não se sobrepõem" — quando já não cabem legíveis perto do
 * ponto (a Pista 3 viu sobreposição a partir de 31 a 390 px), agrupam em "+N".
 * Roda: node --test src/lib/busca/e988-pins-mesmo-ponto.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANEIS_LEGIVEIS, afastarComGrupos, afastarPins, gruposDosPins, type CaixaPin, type Deslocamento } from "./pins-sem-sobreposicao.ts";

type Mapa = Map<string, Deslocamento>;
/** Só os pins que aparecem (os agrupados ficam dentro do "+N" de outro). */
const caixasVisiveis = (pins: CaixaPin[], d: Mapa) =>
  pins
    .filter((p) => !d.get(p.id)?.agrupadoEm)
    .map((p) => {
      const o = d.get(p.id) ?? { dx: 0, dy: 0 };
      return { id: p.id, l: p.x + o.dx - p.w / 2, r: p.x + o.dx + p.w / 2, t: p.y + o.dy - p.h / 2, b: p.y + o.dy + p.h / 2 };
    });
const sobrepostos = (pins: CaixaPin[], d: Mapa) => {
  const c = caixasVisiveis(pins, d);
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

/** A regra do E988 inteira: nenhum visível se cobre, todos no mapa, e cada agrupado tem um visível que o representa. */
function confere(pins: CaixaPin[], d: Mapa) {
  assert.deepEqual(sobrepostos(pins, d), [], "nenhum pin visível cobre outro");
  for (const c of caixasVisiveis(pins, d)) assert.ok(c.l >= 0 && c.r <= quadro.w && c.t >= 0 && c.b <= quadro.h, `${c.id} dentro do mapa`);
  const visiveis = new Set(pins.filter((p) => !d.get(p.id)?.agrupadoEm).map((p) => p.id));
  for (const p of pins) {
    const a = d.get(p.id)?.agrupadoEm;
    if (a) assert.ok(visiveis.has(a), `${p.id} agrupado num pin que aparece (${a})`);
  }
  const g = gruposDosPins(d);
  assert.equal(visiveis.size + [...g.values()].reduce((s, n) => s + n, 0), pins.length, "visíveis + os dos \"+N\" = todos os pins");
}

// Os 23 centros medidos no laboratório (t840 a 390, main 2bbddc98a), na ordem em que o mapa os afasta.
const LAB_390 = [
  [162.5, 318], [162.5, 307], [174.5, 283], [186.5, 307], [174.5, 283], [186.5, 283], [197.5, 283], [151.5, 272],
  [186.5, 283], [197.5, 318], [151.5, 318], [174.5, 283], [151.5, 318], [174.5, 295], [151.5, 318], [186.5, 295],
  [186.5, 283], [162.5, 283], [151.5, 272], [186.5, 283], [174.5, 318], [197.5, 295], [186.5, 307],
] as const;

test("E988: os 23 pins de R$ 3.200 do laboratório (mapa do celular) — cabem legíveis: nenhum agrupado, nenhum par se cobre", () => {
  const pins = LAB_390.map(([x, y], i) => pin(`p${i}`, x, y));
  const d = afastarPins(pins, quadro);
  confere(pins, d);
  assert.equal(gruposDosPins(d).size, 0, "23 pins cabem perto do ponto: nenhum \"+N\"");
});

test("E988 (Pista 3, DUET-0649): 31 pins no mesmo ponto a 390 px — os que não cabem legíveis vão para um \"+N\"; nenhum par se cobre", () => {
  const pins = Array.from({ length: 31 }, (_, i) => pin(`a${i}`, 175, 300));
  const d = afastarPins(pins, quadro);
  confere(pins, d);
  assert.ok(gruposDosPins(d).size >= 1, "há um \"+N\"");
});

test("E988: 100 pins no mesmo ponto — um \"+N\" carrega o que não cabe; nenhum par se cobre", () => {
  const pins = Array.from({ length: 100 }, (_, i) => pin(`c${i}`, 175, 300));
  const d = afastarPins(pins, quadro);
  confere(pins, d);
});

test("E988: depois do zoom para longe (30 pins juntos, perto da borda) — nenhum par se cobre e todos ficam no mapa", () => {
  const pins = Array.from({ length: 30 }, (_, i) => pin(`z${i}`, 60 + (i % 3), 120 + (i % 2)));
  confere(pins, afastarPins(pins, quadro));
});

test("E988: o pin afastado vai no máximo ao anel legível (não aparece longe do próprio ponto)", () => {
  const pins = Array.from({ length: 100 }, (_, i) => pin(`d${i}`, 175, 300));
  const d = afastarPins(pins, quadro);
  for (const p of pins) {
    const o = d.get(p.id)!;
    assert.ok(Math.abs(o.dx) <= ANEIS_LEGIVEIS * (p.w + 4) && Math.abs(o.dy) <= ANEIS_LEGIVEIS * (p.h + 4), `${p.id} perto do ponto (${o.dx}, ${o.dy})`);
  }
});

test("E988: sem grupo, afastarComGrupos é o afastamento de sempre (nada de espaço a mais)", () => {
  const pins = LAB_390.map(([x, y], i) => pin(`p${i}`, x, y));
  assert.deepEqual([...afastarComGrupos(pins, quadro, [], 34)], [...afastarPins(pins, quadro)]);
});

test("E988: os casos que já se resolviam nas 8 direções não mudam (o 2º pin vai logo abaixo do 1º)", () => {
  const pins = [pin("a", 175, 300), pin("b", 175, 300)];
  assert.deepEqual(afastarPins(pins, quadro).get("b"), { dx: 0, dy: 28 });
});

test("E988: pin com o ponto dentro do mapa mas rente à borda (alargado pelo \"+N\") entra no quadro em vez de sair dele", () => {
  const largo: CaixaPin = { id: "borda", x: 340, y: 300, w: 95, h: 24 };
  const o = afastarPins([largo], quadro).get("borda")!;
  assert.ok(largo.x + o.dx + largo.w / 2 <= quadro.w, `dentro do mapa (dx ${o.dx})`);
  // Ponto fora da tela (mapa arrastado): fica onde está.
  assert.deepEqual(afastarPins([{ id: "fora", x: 500, y: 300, w: 69, h: 24 }], quadro).get("fora"), { dx: 0, dy: 0 });
});

test("E988: mapa cheio (com \"+N\") — o pin que mostra o grupo, já alargado pelo selo, não cobre outro nem sai do mapa", () => {
  const SELO = 34;
  for (const n of [31, 32, 60, 100]) {
    const pins = Array.from({ length: n }, (_, i) => pin(`s${n}-${i}`, 175 + (i % 5) * 3, 300 + (i % 3) * 2));
    const d = afastarComGrupos(pins, quadro, [], SELO);
    assert.ok(gruposDosPins(d).size >= 1, `${n} pins: há "+N"`);
    const g = gruposDosPins(d);
    const caixas = pins
      .filter((p) => !d.get(p.id)?.agrupadoEm)
      .map((p) => {
        const o = d.get(p.id)!;
        const extra = g.has(p.id) ? SELO / 2 : 0;
        return { id: p.id, l: p.x + o.dx - p.w / 2 - extra, r: p.x + o.dx + p.w / 2 + extra, t: p.y + o.dy - p.h / 2, b: p.y + o.dy + p.h / 2 };
      });
    for (let i = 0; i < caixas.length; i++) {
      const a = caixas[i];
      assert.ok(a.l >= 0 && a.r <= quadro.w, `${a.id} dentro do mapa (${a.l}..${a.r})`);
      for (let j = i + 1; j < caixas.length; j++) {
        const b = caixas[j];
        assert.ok(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b, `${a.id}×${b.id}`);
      }
    }
  }
});
