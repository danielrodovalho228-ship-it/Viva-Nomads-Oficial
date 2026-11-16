/*
  E715 (O4, resíduo) — a 390 px, os botões "100 Mbps"/"300 Mbps" (pedido novo e filtro do celular) separavam o número
  da unidade em duas linhas. Correção: espaço que não quebra (U+00A0) entre os dois, num rótulo único (rotuloMbps).
  Roda: node --test src/lib/busca/e715-o4-mbps-sem-quebra.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHIPS_INTERNET, rotuloMbps } from "./filtro-internet.ts";

test("E715 O4 — o rótulo junta número e unidade com espaço que não quebra", () => {
  for (const v of CHIPS_INTERNET) {
    assert.equal(rotuloMbps(v), `${v} Mbps`);
    assert.doesNotMatch(rotuloMbps(v), / /); // nenhum espaço comum (onde a linha quebraria)
  }
});

test("E715 O4 — os botões do pedido novo e do filtro do celular usam o rótulo (sem '{v} Mbps' solto)", () => {
  for (const f of ["src/app/(public)/pedidos/novo/page.tsx", "src/components/busca/painel-filtros-celular.tsx"]) {
    const s = readFileSync(f, "utf8");
    assert.match(s, /\{rotuloMbps\(v\)\}/, f);
    assert.doesNotMatch(s, /\{v\} Mbps/, f);
  }
});
