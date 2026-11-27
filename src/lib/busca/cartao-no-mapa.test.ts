/** E524 — cartão do pin dentro do mapa, longe dos botões de zoom, e Esc fecha — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOLGA_CARTAO_MAPA, deslocamentoParaCaber, fechaCartaoComTecla, rolagemParaMostrar } from "./cartao-no-mapa.ts";

const mapa = { left: 0, top: 0, right: 500, bottom: 800 };
const card = (left: number, top: number) => ({ left, top, right: left + 256, bottom: top + 400 });

test("cartão já dentro (com as folgas): não mexe no mapa", () => {
  assert.deepEqual(deslocamentoParaCaber(card(100, 100), mapa), { dx: 0, dy: 0 });
});

test("D10: cartão encostado na borda direita (cobria o zoom) volta para dentro, com folga para os botões de zoom", () => {
  const c = card(239, 5); // right = 495: só 5 px da borda, por baixo do zoom
  const { dx, dy } = deslocamentoParaCaber(c, mapa);
  assert.equal(c.right + dx, mapa.right - FOLGA_CARTAO_MAPA.direita);
  assert.equal(c.top + dy, mapa.top + FOLGA_CARTAO_MAPA.topo);
  // a coluna do zoom ocupa 10 px de margem + 48 px do botão em tela de toque (44 px no computador: 34 + 10)
  assert.ok(FOLGA_CARTAO_MAPA.direita >= 10 + 48 + 8, "folga da direita livra a coluna do zoom também na tela de toque");
  assert.ok(FOLGA_CARTAO_MAPA.esquerda + 256 + FOLGA_CARTAO_MAPA.direita <= 350, "no celular (mapa de 350 px) o cartão de 256 px ainda cabe");
});

test("cartão cortado à esquerda ou embaixo também volta", () => {
  assert.deepEqual(deslocamentoParaCaber(card(-40, 100), mapa), { dx: 40 + FOLGA_CARTAO_MAPA.esquerda, dy: 0 });
  const baixo = card(100, 500); // bottom = 900
  assert.equal(baixo.bottom + deslocamentoParaCaber(baixo, mapa).dy, mapa.bottom - FOLGA_CARTAO_MAPA.base);
});

test("mapa menor que o cartão (celular): prioriza topo e esquerda — o Fechar fica sempre à vista", () => {
  const estreito = { left: 0, top: 0, right: 300, bottom: 350 };
  const { dx, dy } = deslocamentoParaCaber(card(200, -100), estreito);
  assert.equal(200 + dx, FOLGA_CARTAO_MAPA.esquerda);
  assert.equal(-100 + dy, FOLGA_CARTAO_MAPA.topo);
});

test("celular: a página rola para o cartão aparecer entre o topo fixo e a barra de abas (o topo tampava o Fechar)", () => {
  // topo fixo até 72 px, barra de abas a partir de 780 px
  assert.equal(rolagemParaMostrar({ top: 0, bottom: 401 }, 72, 780), -80); // sobe 80: o cartão desce para 80
  assert.equal(rolagemParaMostrar({ top: 500, bottom: 900 }, 72, 780), 128); // desce 128: a base fica em 772
  assert.equal(rolagemParaMostrar({ top: 100, bottom: 500 }, 72, 780), 0);
  // maior que o espaço: vence o topo (Fechar à vista)
  assert.equal(rolagemParaMostrar({ top: 300, bottom: 1100 }, 72, 780), 300 - 80);
});

test("Esc fecha o cartão; outras teclas não", () => {
  assert.equal(fechaCartaoComTecla("Escape"), true);
  assert.equal(fechaCartaoComTecla("Enter"), false);
});

test("os dois motores do mapa usam a regra: Leaflet com as folgas no autoPan e Mapbox com panBy; Esc nos dois", () => {
  const src = readFileSync(new URL("../../components/search-map.tsx", import.meta.url), "utf8");
  assert.match(src, /autoPanPaddingTopLeft: \[FOLGA_CARTAO_MAPA\.esquerda, FOLGA_CARTAO_MAPA\.topo\]/);
  assert.match(src, /autoPanPaddingBottomRight: \[FOLGA_CARTAO_MAPA\.direita, FOLGA_CARTAO_MAPA\.base\]/);
  assert.match(src, /deslocamentoParaCaber\(/);
  assert.match(src, /map\.panBy\(\[-dx, -dy\]/);
  assert.equal(src.match(/mostrarCartaoNaTela\(popupEl\)/g)?.length, 2, "rola a página até o cartão nos dois motores");
  // E442: o Esc fecha o cartão do clique E a prévia do hover (o mesmo `fechar`).
  assert.equal(src.match(/  useFecharCartaoComEsc\(!!aberto, fechar\);/g)?.length, 2, "Esc nos dois motores");
});
