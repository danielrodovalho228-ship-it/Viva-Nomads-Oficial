/*
  Guardas de fonte (sem banco): impedem a volta de dois erros achados no laboratório (lab 5f29f7fb, c15b2c6).
  Roda: node --test tests/laboratorio/specs-faixa-b-guarda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SPECS = "tests/e2e/specs";

test("specs que semeiam chamado de visitante pelo banco informam o nome (gatilho da 0120: 2 a 60 caracteres)", () => {
  const sem: string[] = [];
  for (const f of readdirSync(SPECS).filter((n) => n.endsWith(".spec.ts"))) {
    for (const linha of readFileSync(`${SPECS}/${f}`, "utf8").split("\n")) {
      if (/\.insert\(\{[^\n]*visitante_email/.test(linha) && !/visitante_nome/.test(linha)) sem.push(`${f}: ${linha.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(sem, []);
});

test("detalhe do contrato: linhas do resumo e o aviso quebram texto sem espaço (UUID) para não rolar de lado a 360 px", () => {
  const src = readFileSync("src/components/contrato/contrato-detalhe.tsx", "utf8");
  assert.match(src, /<li key=\{linha\} className="[^"]*\[overflow-wrap:anywhere\]/);
  assert.match(src, /data-testid="contrato-aviso-assinatura"/);
  assert.match(src, /className="[^"]*\[overflow-wrap:anywhere\][^"]*" data-testid="contrato-aviso-assinatura"/);
});
