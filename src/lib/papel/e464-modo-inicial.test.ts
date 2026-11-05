/**
 * E464 (complemento): o cabeçalho ainda nascia como proprietário nas telas da Conta (T886, lab-critico da #2603).
 * Causa: o ModeInitializer aplica o modo do servidor em TODA carga do painel com setActiveMode — que é a troca
 * explícita de modo e por isso DESLIGA o papel parceiro (parceiroAtivo: false). A leitura do perfil religava o
 * parceiro logo depois: proprietário → parceiro a cada página. O modo inicial do servidor não é uma escolha da pessoa:
 * acerta só o modo de baixo e preserva o papel parceiro. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../components/layout/mode-initializer.tsx", import.meta.url), "utf8");

test("o modo inicial do servidor não desliga o papel parceiro", () => {
  assert.doesNotMatch(src, /setActiveMode\(modo\)/);
  assert.match(src, /useAuthStore\.setState\(\{ activeMode: modo \}\)/);
});

test("setActiveMode (a troca explícita) continua desligando o parceiro", () => {
  const store = readFileSync(new URL("../store.ts", import.meta.url), "utf8");
  assert.match(store, /setActiveMode: \(activeMode\) => set\(\{ activeMode, parceiroAtivo: false \}\)/);
});
