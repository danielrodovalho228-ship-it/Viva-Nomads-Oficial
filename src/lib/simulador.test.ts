import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comissaoAnualSobreTotal,
  contratosPorAno,
  simularRentabilidade,
  compararPlanos,
  recomendarPlano,
  simularROI,
  type PlanoCalc,
} from "./simulador.ts";
import { PLANOS } from "../config/planos.ts";

// Usa a configuração REAL (src/config/planos.ts): o fixture copiado ficou velho
// (10%/8%) quando as taxas viraram 12%/8%/4% e a recomendação mudou sem o teste ver.
const PLANOS_CALC: PlanoCalc[] = PLANOS.map((p) => ({
  id: p.id,
  nome: p.nome,
  comissao: p.comissao,
  assinaturaAnual: p.assinaturaAnual,
}));

test("contratosPorAno = meses / prazo (limitado a 12 meses)", () => {
  assert.equal(contratosPorAno(10, 4), 2.5);
  assert.equal(contratosPorAno(12, 6), 2);
  assert.equal(contratosPorAno(6, 2), 3);
  assert.equal(contratosPorAno(20, 4), 3); // clamp 12/4
  assert.equal(contratosPorAno(10, 0), 10); // prazo mínimo 1
});

test("rentabilidade: comissão = % × valor TOTAL dos contratos do ano (Profissional 8%)", () => {
  const r = simularRentabilidade(
    { aluguelMensal: 3000, condoIptu: 500, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    1548
  );
  assert.equal(r.receitaBrutaAnual, 30000); // 3000 × 10
  assert.equal(r.custosAnuais, 500 * 12 + 350 * 10); // 9500
  assert.equal(r.comissaoAnual, Math.round(2.5 * 4 * 0.08 * 3000)); // 2.400: 8% sobre 10 meses de aluguel, não só o 1º mês
  assert.equal(r.assinaturaAnual, 1548);
  assert.equal(r.receitaLiquidaAnual, 30000 - 9500 - 2400 - 1548);
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

test("recomendação: BAIXO volume → Gratuito é o melhor plano (honestidade)", () => {
  // 2.000/mês, 6 meses ocupados → R$ 12.000/ano de aluguel. Abaixo de ~R$ 14.700/ano
  // (588 ÷ 4 pontos de taxa) a assinatura do Essencial não se paga: o Gratuito deixa mais líquido.
  const r = recomendarPlano(
    { aluguelMensal: 2000, condoIptu: 0, contas: 0, mesesOcupados: 6, prazoMedioMeses: 6 },
    PLANOS_CALC
  );
  assert.equal(r?.planoId, "free");
});

test("recomendação: valor médio → Essencial; a taxa incide sobre o valor TOTAL do contrato", () => {
  // 3.000/mês × 6 meses = R$ 18.000/ano: Gratuito 12% = 2.160; Essencial 8% + 588 = 2.028.
  const r = recomendarPlano(
    { aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 6, prazoMedioMeses: 6 },
    PLANOS_CALC
  );
  assert.equal(r?.planoId, "essential");
});

test("recomendação: ALTO volume/valor → plano pago vence e MUDA com o volume", () => {
  // 10.000/mês, 12 meses → R$ 120.000/ano: 4% + 1.548 = 6.348 < 8% + 588 = 10.188 < 12% = 14.400.
  const r = recomendarPlano(
    { aluguelMensal: 10000, condoIptu: 0, contas: 0, mesesOcupados: 12, prazoMedioMeses: 2 },
    PLANOS_CALC
  );
  assert.notEqual(r?.planoId, "free");
  assert.equal(r?.planoId, "pro");
});

test("recomendação: Gestor (sob consulta) nunca é recomendado automaticamente", () => {
  const r = recomendarPlano(
    { aluguelMensal: 99999, condoIptu: 0, contas: 0, mesesOcupados: 12, prazoMedioMeses: 2 },
    PLANOS_CALC
  );
  assert.notEqual(r?.planoId, "gestor");
});

test("ROI: prêmio, payback e roi anual coerentes", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    1548
  );
  assert.equal(r.premioMensal, 1200);
  assert.ok(Math.abs(r.premioPct - 1200 / 1800) < 1e-9);
  // netMobiliado = 3000×10 − (8% × 3000 × 10 meses = 2400) − 1548 = 26052
  assert.equal(r.netMobiliadoAnual, 26052);
  assert.equal(r.netVazioAnual, 1800 * 12); // 21600
  assert.equal(r.ganhoAdicionalAnual, 26052 - 21600); // 4452
  assert.equal(r.paybackMeses, Math.ceil(25000 / (4452 / 12)));
  assert.ok((r.roiAnual ?? 0) > 0);
  assert.equal(r.acumulado.length, 3);
  assert.equal(r.acumulado[0].mobiliado, 26052 - 25000); // ano 1 desconta investimento
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

test("ROI: mobiliado abaixo do vazio mostra prêmio NEGATIVO de verdade", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 3000, aluguelMobiliado: 2800, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.08,
    0
  );
  assert.equal(r.premioMensal, -200);
  assert.ok(r.ganhoAdicionalAnual < 0);
  assert.equal(r.paybackMeses, null);
});

test("ROI: investimento zero e ganho positivo → payback imediato e ROI indefinido", () => {
  const r = simularROI(
    { investimentoMobiliar: 0, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4 },
    0,
    0
  );
  assert.ok(r.ganhoAdicionalAnual > 0);
  assert.equal(r.paybackMeses, 0);
  assert.equal(r.roiAnual, null);
});

test("ROI: contas incluídas e reposição da mobília entram como custo do mobiliado (F4)", () => {
  const base = { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4 };
  const sem = simularROI(base, 0.08, 1548);
  const com = simularROI({ ...base, contasMensais: 400, reposicaoAnualPct: 0.1 }, 0.08, 1548);
  // 400 × 10 meses + 10% de 25.000 = 6.500 a menos por ano
  assert.equal(com.custosMobiliadoAnual, 6500);
  assert.equal(sem.netMobiliadoAnual - com.netMobiliadoAnual, 6500);
});

test("comissão sobre o valor total (ordem 5df28a7b): R$ 3.000 a 12% = 360 / 720 / 1.080 por contrato de 1 / 2 / 3 meses; prazo adulterado não zera", () => {
  for (const [prazo, esperado] of [[1, 360], [2, 720], [3, 1080]] as const) {
    assert.equal(comissaoAnualSobreTotal(1, prazo, 0.12, 3000), esperado);
  }
  assert.equal(comissaoAnualSobreTotal(1, 0, 0.12, 3000), 360); // prazo mínimo 1
  assert.equal(comissaoAnualSobreTotal(1, 3, -1, 3000), 0); // taxa negativa não vira crédito
  // 12 meses ocupados em contratos de 3 meses = 4 contratos × R$ 1.080
  const r = simularRentabilidade({ aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 12, prazoMedioMeses: 3 }, 0.12, 0);
  assert.equal(r.comissaoAnual, 4320);
});
