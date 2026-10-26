/* Roda: node --test src/lib/papel/troca-um-toque.test.ts — E190 (Modo proprietário em 1 toque). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a troca pedida no menu da Conta não é desfeita pela guarda de rota da tela do outro papel", () => {
  const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
  assert.match(shell, /async function irParaModo\(alvo: ViewMode\) \{\s*trocaPedida\.current = alvo;\s*setActiveMode\(alvo\);/);
  assert.match(shell, /if \(trocaPedida\.current === mode\) \{\s*if \(!hits\) trocaPedida\.current = null;\s*return;\s*\}/);
});
