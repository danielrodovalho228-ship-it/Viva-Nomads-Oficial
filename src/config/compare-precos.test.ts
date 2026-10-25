/* Roda: node --test src/config/compare-precos.test.ts */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFERENCIAIS_VIVA, LINHAS_COMPARE, linhasPublicas } from "./compare-precos.ts";
import { achadosNoTexto } from "../lib/varredura-texto.ts";

// Ordem add57bc7 (achado do Moacir): o t118 varre /precos e achou "check-in" e "reserva" no comparativo.
test("texto publicado em /precos passa pela varredura de vocabulário", () => {
  const textos = [
    ...DIFERENCIAIS_VIVA,
    ...linhasPublicas().flatMap((l) => [l.nome, l.regra]),
  ];
  for (const t of textos) {
    assert.deepEqual(achadosNoTexto(t, { vocabulario: true }), [], t);
  }
});

test("linhas ocultas continuam sem fonte (não vão para a tela)", () => {
  assert.ok(LINHAS_COMPARE.filter((l) => l.fonte === null).every((l) => !linhasPublicas().includes(l)));
});

test("E54: a linha do Airbnb separa anfitrião × hóspede como o artigo 1857 (sem dar ao anfitrião a taxa do hóspede)", () => {
  const a = LINHAS_COMPARE.find((l) => l.id === "airbnb")!;
  assert.match(a.regra, /^Anfitrião no Brasil: taxa única de 16% sobre a estadia\./);
  assert.match(a.regra, /estrutura dividida, que está sendo encerrada, o anfitrião paga 4% e o viajante paga de 14,1% a 16,5%\./);
  assert.doesNotMatch(a.regra, /16% sobre cada estadia para anfitriões/);
  assert.equal(a.pct, 0.16);
  assert.equal(a.fonte?.url, "https://www.airbnb.com.br/help/article/1857");
  assert.equal(a.conferidoEm, "2026-10-24");
});
