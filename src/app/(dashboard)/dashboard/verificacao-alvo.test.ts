/* Roda: node --test "src/app/(dashboard)/dashboard/verificacao-alvo.test.ts" — varredura 01/11 (Pista A): no Início do painel o botão "Iniciar verificação" / "Continuar verificação" tinha 36 px de altura; agora 44 px. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./visao-geral-client.tsx", import.meta.url), "utf8");

test("Início: botão de verificação com 44 px", () => {
  assert.match(src, /inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-champagne px-4 text-sm/);
  assert.doesNotMatch(src, /rounded-full bg-champagne px-4 py-2 text-sm/);
});
