import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contratosPorAno,
  simularRentabilidade,
  compararPlanos,
  simularROI,
} from "./simulador.ts";

test("contratosPorAno = meses / prazo (limitado a 12 meses)", () => {
  assert.equal(contratosPorAno(10, 4), 2.5);
  assert.equal(contratosPorAno(12, 6), 2);
  assert.equal(contratosPorAno(6, 2), 3);
  assert.equal(contratosPorAno(20, 4), 3); // clamp 12/4
  assert.equal(contratosPorAno(10, 0), 10); // prazo mínimo 1
});

test("rentabilidade: comissão = % × 1º aluguel × contratos/ano (Profissional 8%)", () => {
  const r = simularRentabilidade(
    { aluguelMensal: 3000, condoIptu: 500, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    1548
  );
  assert.equal(r.receitaBrutaAnual, 30000); // 3000 × 10
  assert.equal(r.custosAnuais, 500 * 12 + 350 * 10); // 9500
  assert.equal(r.comissaoAnual, Math.round(2.5 * 0.08 * 3000)); // 600
  assert.equal(r.assinaturaAnual, 1548);
  assert.equal(r.receitaLiquidaAnual, 30000 - 9500 - 600 - 1548);
  assert.equal(r.mediaMensal, Math.round(r.receitaLiquidaAnual / 12));
});

test("rentabilidade: Gestor tem comissão 0", () => {
  const r = simularRentabilidade(
    { aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 12, prazoMedioMeses: 6 },
    0,
    0
  );
  assert.equal(r.comissaoAnual, 0);
  assert.equal(r.receitaLiquidaAnual, 36000);
});

test("comparador: líquido cai conforme comissão/assinatura sobem", () => {
  const e = { aluguelMensal: 3000, condoIptu: 500, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4 };
  const planos = [
    { id: "free" as const, nome: "Gratuito", comissao: 0.12, assinaturaAnual: 0 },
    { id: "pro" as const, nome: "Profissional", comissao: 0.08, assinaturaAnual: 1548 },
    { id: "gestor" as const, nome: "Gestor", comissao: 0, assinaturaAnual: null },
  ];
  const c = compararPlanos(e, planos);
  assert.equal(c.length, 3);
  const gestor = c.find((x) => x.planoId === "gestor");
  const pro = c.find((x) => x.planoId === "pro");
  assert.ok(gestor && pro);
  assert.equal(gestor.comissaoAnual, 0);
  assert.equal(gestor.sobConsulta, true);
  // Gestor: sem comissão e assinatura 0 no cálculo → maior líquido
  assert.ok(gestor.liquidoProprietario >= pro.liquidoProprietario);
});

test("ROI: prêmio, payback e roi anual coerentes", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    1548
  );
  assert.equal(r.premioMensal, 1200);
  assert.ok(Math.abs(r.premioPct - 1200 / 1800) < 1e-9);
  // netMobiliado = 3000×10 − (2.5×0.08×3000=600) − 1548 = 27852
  assert.equal(r.netMobiliadoAnual, 27852);
  assert.equal(r.netVazioAnual, 1800 * 12); // 21600
  assert.equal(r.ganhoAdicionalAnual, 27852 - 21600); // 6252
  assert.equal(r.paybackMeses, Math.ceil(25000 / (6252 / 12)));
  assert.ok(r.roiAnual > 0);
  assert.equal(r.acumulado.length, 3);
  assert.equal(r.acumulado[0].mobiliado, 27852 - 25000); // ano 1 desconta investimento
});

test("ROI: sem ganho adicional → payback null", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 3000, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    1548
  );
  assert.equal(r.premioMensal, 0);
  assert.equal(r.paybackMeses, null);
});
