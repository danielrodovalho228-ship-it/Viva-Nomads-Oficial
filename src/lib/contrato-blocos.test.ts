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
  fimInclusivoISO,
  diasInclusivos,
  caucaoDoBloco,
  cabeNoPrazoMaximo,
  PRAZO_MAX_DIAS,
  PRAZO_MAX_MESES,
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

test("encadearDatas: fim inclusivo, próximo bloco no dia seguinte, cada um ≤ 90 dias", () => {
  const blocos = planejarBlocos(6, 3000, 2);
  const comDatas = encadearDatas("2026-01-01", blocos);
  assert.equal(comDatas[0].inicio, "2026-01-01");
  assert.equal(comDatas[0].fim, "2026-03-01"); // 60 dias: 01/01 a 01/03 (inclusive)
  for (let i = 1; i < comDatas.length; i++) {
    assert.equal(comDatas[i].inicio, addDiasISO(comDatas[i - 1].fim, 1));
  }
  for (const b of comDatas) {
    const dias = diasInclusivos(b.inicio, b.fim);
    assert.ok(dias <= 90, `bloco ${b.numero} tem ${dias} dias`);
    assert.equal(dias, b.meses * DIAS_POR_MES);
  }
  // 6 meses = 180 dias no total, nunca 181+.
  assert.equal(diasInclusivos(comDatas[0].inicio, comDatas[comDatas.length - 1].fim), 180);
});

test("fim inclusivo: 90 dias a partir de 31/01 terminam em 30/04 (antes 01/05 = 91 dias)", () => {
  assert.equal(fimInclusivoISO("2026-01-31", 90), "2026-04-30");
  assert.equal(diasInclusivos("2026-01-31", "2026-05-01"), 91);
  assert.equal(diasInclusivos("2026-01-31", fimInclusivoISO("2026-01-31", 90)), 90);
});

test("caução do bloco: 50% do bloco, mas a soma do contrato nunca passa de 3 aluguéis", () => {
  assert.equal(caucaoDoBloco(6000, 3000, 0), 3000);
  assert.equal(caucaoDoBloco(6000, 3000, 7000), 2000); // só falta 2.000 para 9.000
  assert.equal(caucaoDoBloco(6000, 3000, 9000), 0);
  // 6 meses em blocos de 3: 4.500 + 4.500 = 9.000 = 3 aluguéis.
  const total = planejarBlocos(6, 3000, 3).reduce((s, b) => s + b.caucao, 0);
  assert.ok(total <= 3 * 3000);
});

test("renovação só cabe até 180 dias no total", () => {
  assert.equal(cabeNoPrazoMaximo(120, 2), true); // 120 + 60 = 180
  assert.equal(cabeNoPrazoMaximo(150, 2), false); // 210
  assert.equal(PRAZO_MAX_DIAS, 180);
  assert.equal(PRAZO_MAX_MESES, 6);
});
