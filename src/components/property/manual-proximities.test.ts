import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// t186 (1280 px): a linha de "o que tem perto" passava da borda do cartão do cadastro.
const fonte = readFileSync("src/components/property/manual-proximities.tsx", "utf8");

test("linha de campos quebra em vez de estourar o cartão", () => {
  assert.match(fonte, /flex flex-col gap-2 sm:flex-row sm:flex-wrap/);
});

test("campo do nome pode encolher (min-w-0) e tem largura mínima própria", () => {
  assert.match(fonte, /min-w-0 flex-1[^"]*sm:min-w-\[14rem\]/);
});
