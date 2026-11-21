/*
  E962 — a home não declarava o teto de 3× nem o pagamento direto ao proprietário. Decisão (ORDEM-DUET-080): a home
  importa CAUCAO_FRASE de src/lib/faixas.ts — importada, nunca reescrita; é a mesma frase das superfícies irmãs.
  Roda: node --test "src/app/(public)/home-caucao-e962.test.ts"
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAUCAO_FRASE } from "../../lib/faixas.ts";

const home = readFileSync("src/app/(public)/page.tsx", "utf8");

test("E962 — a home importa CAUCAO_FRASE de @/lib/faixas e a usa no passo de assinatura", () => {
  assert.match(home, /import \{[^}]*\bCAUCAO_FRASE\b[^}]*\} from "@\/lib\/faixas";/);
  const passo3 = home.slice(home.indexOf('<Step n="3"'), home.indexOf('<Step n="4"'));
  assert.match(passo3, /\$\{CAUCAO_FRASE\}/, "passo 3 usa a frase importada");
});

test("E962 — a home nunca reescreve a frase: nenhum literal de teto ou de pagamento direto fora do import", () => {
  assert.ok(!home.includes(CAUCAO_FRASE), "a frase não pode aparecer copiada no arquivo");
  assert.doesNotMatch(home, /3 vezes o valor mensal|direto ao proprietário|Caução combinada/);
});
