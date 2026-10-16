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
