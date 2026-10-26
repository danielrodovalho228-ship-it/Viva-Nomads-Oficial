/* Roda: node --test src/lib/papel/troca-um-toque.test.ts — E190 (Modo proprietário em 1 toque). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a troca do menu da Conta grava primeiro e abre o Início numa navegação nova (nada da tela antiga a desfaz)", () => {
  const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
  assert.match(shell, /async function irParaModo\(alvo: ViewMode\) \{\s*await salvarModo\(alvo\)\.catch\(\(\) => \{\}\);\s*window\.location\.assign\("\/dashboard"\);\s*\}/);
});
