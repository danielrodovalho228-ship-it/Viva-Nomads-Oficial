/*
  Ordem 0569d129 (varredura de termos), achado do Moacir: o texto VISÍVEL da comissão no Fechamento
  do dono dizia "(aluguel × meses)"; o termo padrão é "valor mensal". Comentários de código ficam.
  Roda: node --test src/lib/fechamento-valor-mensal.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const f = readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8");

test("Fechamento: a cobrança da taxa fala em 'valor mensal × meses', não 'aluguel × meses'", () => {
  assert.ok(f.includes("(valor mensal × meses)"));
  const visiveis = f.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("{/*"));
  assert.equal(visiveis.filter((l) => l.includes("aluguel × meses")).length, 0);
});
