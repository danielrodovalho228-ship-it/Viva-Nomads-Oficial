/*
  Testes das regras puras do contrato fracionado em blocos.
  Roda com: node --experimental-strip-types --test src/lib/contrato-blocos.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  planejarBlocos,
  comissaoContrato,
  resumoContrato,
  encadearDatas,
  addDiasISO,
  MAX_MESES_BLOCO,
  DIAS_POR_MES,
} from "./contrato-blocos.ts";

test("6 meses em blocos de 2 → 3 blocos iguais (aluguel 3000)", () => {
  const b = planejarBlocos(6, 3000, 2);
  assert.equal(b.length, 3);
  for (const bloco of b) {
    assert.equal(bloco.meses, 2);
    assert.equal(bloco.valor, 6000); // 3000 × 2
    assert.equal(bloco.caucao, 3000); // 50% do bloco
    assert.equal(bloco.desembolso, 9000); // 6000 + 3000
  }
});

test("5 meses em blocos de 2 → [2,2,1], último bloco menor", () => {
  const b = planejarBlocos(5, 3000, 2);
  assert.deepEqual(
    b.map((x) => x.meses),
    [2, 2, 1]
  );
  assert.equal(b[2].valor, 3000); // 1 mês
  assert.equal(b[2].caucao, 1500); // 50%
});

test("nenhum bloco excede 90 dias — tamanho pedido é limitado a MAX_MESES_BLOCO", () => {
  assert.equal(MAX_MESES_BLOCO, 3); // 90 / 30
  const b = planejarBlocos(8, 3000, 6); // pediu 6 meses/bloco → limita a 3
  for (const bloco of b) assert.ok(bloco.meses <= MAX_MESES_BLOCO);
  assert.deepEqual(
    b.map((x) => x.meses),
    [3, 3, 2]
  );
});

test("bloco nunca maior que o prazo total", () => {
  const b = planejarBlocos(1, 3000, 2);
  assert.equal(b.length, 1);
  assert.equal(b[0].meses, 1);
});

test("comissão do contrato-mãe: 1 mês × taxa, uma vez", () => {
  assert.equal(comissaoContrato(3000, 0.1), 300); // Essencial 10%
  assert.equal(comissaoContrato(3000, 0.08), 240); // Profissional 8%
  assert.equal(comissaoContrato(3000, 0.12), 360); // Gratuito 12%
  assert.equal(comissaoContrato(3000, 0), 0); // Gestor 0%
});

test("resumo do contrato: totais e comissão única", () => {
  const r = resumoContrato(6, 3000, 0.1, 2);
  assert.equal(r.valorTotalPeriodo, 18000); // 3000 × 6
  assert.equal(r.caucaoTotal, 9000); // 3 blocos × 3000
  assert.equal(r.comissaoValor, 300); // 1 mês × 10%, UMA vez (não por bloco)
  assert.equal(r.desembolsoPrimeiroBloco, 9000); // 6000 aluguel + 3000 caução
  assert.equal(r.blocos.length, 3);
});

test("T-TRAV-D: fechamento de 4 meses @3200 → 2 blocos, total R$12.800, caução 50% do bloco, comissão única", () => {
  const r = resumoContrato(4, 3200, 0.1, 2);
  assert.equal(r.blocos.length, 2); // 4 meses / 2 = 2 blocos
  assert.equal(r.valorTotalPeriodo, 12800); // 3200 × 4
  for (const bloco of r.blocos) {
    assert.equal(bloco.meses, 2);
    assert.equal(bloco.valor, 6400); // 3200 × 2
    assert.equal(bloco.caucao, 3200); // 50% do bloco (metade de 6400)
  }
  assert.equal(r.comissaoValor, 320); // 1 mês × 10%, UMA vez no contrato (não por bloco)
  assert.equal(r.desembolsoPrimeiroBloco, 9600); // 6400 aluguel + 3200 caução
});

test("addDiasISO soma dias corretamente (sem depender de now)", () => {
  assert.equal(addDiasISO("2026-01-01", 30), "2026-01-31");
  assert.equal(addDiasISO("2026-01-31", 1), "2026-02-01");
});

test("encadearDatas: blocos contíguos, cada um ≤ 90 dias", () => {
  const blocos = planejarBlocos(6, 3000, 2);
  const comDatas = encadearDatas("2026-01-01", blocos);
  assert.equal(comDatas[0].inicio, "2026-01-01");
  // cada bloco começa onde o anterior terminou
  for (let i = 1; i < comDatas.length; i++) {
    assert.equal(comDatas[i].inicio, comDatas[i - 1].fim);
  }
  // nenhum bloco excede 90 dias
  for (const b of comDatas) {
    const dias =
      (Date.parse(`${b.fim}T00:00:00Z`) - Date.parse(`${b.inicio}T00:00:00Z`)) / 86400000;
    assert.ok(dias <= 90, `bloco ${b.numero} tem ${dias} dias`);
    assert.equal(dias, b.meses * DIAS_POR_MES);
  }
});
