/* Roda: node --test src/lib/admin/contrato-saida-admin.test.ts — E198 (saída explícita no detalhe do contrato do admin). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { periodoDaEstadia, textoSaida, textoEntrada } from "../estadia/estadia.ts";

test("VN-CT-D5D50247: um bloco de 01/10 a 31/10/2026 → 'Saída: 31/10/2026'", () => {
  const p = periodoDaEstadia([{ inicio: "2026-10-01", fim: "2026-10-31" }], null);
  assert.equal(textoEntrada(p), "Entrada: 01/10/2026");
  assert.equal(textoSaida(p), "Saída: 31/10/2026");
});

test("o detalhe do admin mostra entrada e saída pelos blocos (sem mexer no resumo assinado)", () => {
  const tela = readFileSync("src/app/(dashboard)/admin/contratos/[id]/page.tsx", "utf8");
  const dados = readFileSync("src/lib/data/contrato-admin.ts", "utf8");
  assert.match(tela, /data-testid="admin-contrato-saida">\{c\.periodo\.saida\}/);
  assert.match(dados, /contrato_blocos\(inicio, fim\)/);
  assert.match(dados, /periodo: \{ entrada: textoEntrada\(periodo\), saida: textoSaida\(periodo\) \}/);
});
