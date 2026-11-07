import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CIDADES_ROTULADAS, obstaculosDeCidades } from "./rotulos-cidade-leaflet.ts";
import { afastarPins } from "./pins-sem-sobreposicao.ts";

// E704 (mapa de reserva, Leaflet + CARTO — o que roda em produção): o nome da cidade vem DESENHADO no tile, então não
// há dado de posição para ler. O obstáculo vem do ponto conhecido da cidade (o mesmo onde o tile a rotula).
test("a cidade rotulada vira um obstáculo na posição projetada; fora do quadro, nenhum", () => {
  const projetar = (lat: number, lng: number) => ({ x: 400 + (lng + 48.27) * 1000, y: 300 - (lat + 18.92) * 1000 });
  const dentro = obstaculosDeCidades(projetar, { w: 800, h: 600 });
  assert.equal(dentro.length, CIDADES_ROTULADAS.length);
  assert.ok(dentro[0].w >= 80 && dentro[0].h >= 20);
  assert.deepEqual(obstaculosDeCidades(() => ({ x: -5000, y: -5000 }), { w: 800, h: 600 }), []);
});

test("os pinos de R$ 2.430, R$ 3.470 e R$ 4.420 sobre 'UBERLÂNDIA' saem de cima do nome", () => {
  const nome = { x: 300, y: 200, w: 120, h: 24 };
  const pins = [
    { id: "2430", x: 280, y: 200, w: 64, h: 24 },
    { id: "3470", x: 310, y: 198, w: 64, h: 24 },
    { id: "4420", x: 340, y: 204, w: 64, h: 24 },
  ];
  const d = afastarPins(pins, { w: 800, h: 600 }, [nome]);
  for (const p of pins) {
    const o = d.get(p.id)!;
    const l = p.x + o.dx - p.w / 2, r = p.x + o.dx + p.w / 2, t = p.y + o.dy - p.h / 2, b = p.y + o.dy + p.h / 2;
    const cobre = !(r <= nome.x - nome.w / 2 || l >= nome.x + nome.w / 2 || b <= nome.y - nome.h / 2 || t >= nome.y + nome.h / 2);
    assert.equal(cobre, false, p.id);
  }
});

test("o mapa Leaflet passa esses obstáculos ao afastamento de pinos", () => {
  const fonte = readFileSync("src/components/search-map.tsx", "utf8");
  const leaflet = fonte.slice(fonte.indexOf("function SearchMapLeaflet"));
  assert.match(leaflet, /obstaculosDeCidades\(/);
});
