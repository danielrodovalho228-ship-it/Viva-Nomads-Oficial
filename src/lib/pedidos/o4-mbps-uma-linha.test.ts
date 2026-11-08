// O4 (QA, resíduo do E715): em /pedidos/novo os rótulos "50 Mbps", "100 Mbps" e "300 Mbps" quebravam em duas linhas a 360 e 390 px
// ("100" em cima, "Mbps" embaixo). O número e a unidade agora ficam presos por um espaço inquebrável.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/app/(public)/pedidos/novo/page.tsx", "utf8");

test("O4: o rótulo de internet usa espaço inquebrável entre o número e 'Mbps' (nunca um espaço comum)", () => {
  assert.match(s, /\{v\}&nbsp;Mbps/);
  assert.doesNotMatch(s, /\{v\} Mbps/);
});

test("O4: o chip de internet cabe em 3 colunas a 360 px (folga menor no celular, normal a partir de sm)", () => {
  assert.match(s, /testid=\{`pedido-internet-\$\{v\}`\} className="gap-1 px-2 sm:gap-2 sm:px-3"/);
});
