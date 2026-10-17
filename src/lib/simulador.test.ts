/* Os testes anteriores ao prompt 15 passam as opções ANTIGAS explicitamente (condomínio/contas incluídos;
   tradicional sem mês vazio, sem administração e sem intermediação) e continuam com os mesmos números. */
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

// Espelha config/planos.ts (Grátis 12%/R$0, Essencial 10%/R$588, Pro 8%/R$1548,
// Gestor sob consulta).
const PLANOS_CALC: PlanoCalc[] = [
  { id: "free", nome: "Gratuito", comissao: 0.12, assinaturaAnual: 0 },
  { id: "essential", nome: "Essencial", comissao: 0.1, assinaturaAnual: 588 },
  { id: "pro", nome: "Profissional", comissao: 0.08, assinaturaAnual: 1548 },
  { id: "gestor", nome: "Gestor", comissao: 0, assinaturaAnual: null },
];

test("contratosPorAno = meses / prazo (limitado a 12 meses)", () => {
  assert.equal(contratosPorAno(10, 4), 2.5);
  assert.equal(contratosPorAno(12, 6), 2);
  assert.equal(contratosPorAno(6, 2), 3);
  assert.equal(contratosPorAno(20, 4), 3); // clamp 12/4
  assert.equal(contratosPorAno(10, 0), 10); // prazo mínimo 1
});

test("rentabilidade: comissão = % × valor TOTAL dos contratos do ano (Profissional 8%)", () => {
  const r = simularRentabilidade(
    { aluguelMensal: 3000, condoIptu: 500, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4, condoCobranca: "incluido" as const, contasCobranca: "incluido" as const },
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
  const e = { aluguelMensal: 3000, condoIptu: 500, contas: 350, mesesOcupados: 10, prazoMedioMeses: 4, condoCobranca: "incluido" as const, contasCobranca: "incluido" as const };
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
  // 3.000/mês, 6 meses ocupados, prazo 6 → ~1 contrato/ano. A assinatura anual
  // não se paga: o Gratuito deixa mais líquido.
  const r = recomendarPlano(
    { aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 6, prazoMedioMeses: 6 },
    PLANOS_CALC
  );
  assert.equal(r?.planoId, "free");
});

test("recomendação: ALTO volume/valor → plano pago vence e MUDA com o volume", () => {
  // 10.000/mês, 12 meses, prazo 2 → 6 contratos/ano. A economia de comissão
  // supera a assinatura: o recomendado deixa de ser o Gratuito.
  const r = recomendarPlano(
    { aluguelMensal: 10000, condoIptu: 0, contas: 0, mesesOcupados: 12, prazoMedioMeses: 2 },
    PLANOS_CALC
  );
  assert.notEqual(r?.planoId, "free");
  assert.equal(r?.planoId, "pro"); // 8% + 1548 < 10% + 588 < 12% neste volume
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
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0, contasCobranca: "incluido" as const },
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
    { investimentoMobiliar: 25000, aluguelVazio: 3000, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0, contasCobranca: "incluido" as const },
    0.08,
    1548
  );
  assert.equal(r.premioMensal, 0);
  assert.equal(r.paybackMeses, null);
});

test("ROI: mobiliado abaixo do vazio mostra prêmio NEGATIVO de verdade", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 3000, aluguelMobiliado: 2800, mesesOcupados: 10, prazoMedioMeses: 4, mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0, contasCobranca: "incluido" as const },
    0.08,
    0
  );
  assert.equal(r.premioMensal, -200);
  assert.ok(r.ganhoAdicionalAnual < 0);
  assert.equal(r.paybackMeses, null);
});

test("ROI: investimento zero e ganho positivo → payback imediato e ROI indefinido", () => {
  const r = simularROI(
    { investimentoMobiliar: 0, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0, contasCobranca: "incluido" as const },
    0,
    0
  );
  assert.ok(r.ganhoAdicionalAnual > 0);
  assert.equal(r.paybackMeses, 0);
  assert.equal(r.roiAnual, null);
});

test("ROI: contas incluídas e reposição da mobília entram como custo do mobiliado (F4)", () => {
  const base = { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0, contasCobranca: "incluido" as const };
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

// Com as faixas REAIS (config/planos.ts), não o espelho acima: é o que a tela do
// simulador usa e o que o spec t12 confere (lab 15/10: 3.000 × 6 meses já
// recomenda o Essencial; o Gratuito só ganha em valor menor).
const PLANOS_REAIS: PlanoCalc[] = PLANOS.map((p) => ({
  id: p.id,
  nome: p.nome,
  comissao: p.comissao,
  assinaturaAnual: p.assinaturaAnual,
}));

test("recomendação com as faixas reais: 1.500 × 1 contrato de 6 meses → Gratuito", () => {
  const r = recomendarPlano(
    { aluguelMensal: 1500, condoIptu: 0, contas: 0, mesesOcupados: 6, prazoMedioMeses: 6 },
    PLANOS_REAIS
  );
  assert.equal(r?.planoId, "free");
});

test("recomendação com as faixas reais: 3.000 × 1 contrato de 6 meses → já não é o Gratuito", () => {
  const r = recomendarPlano(
    { aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 6, prazoMedioMeses: 6 },
    PLANOS_REAIS
  );
  assert.notEqual(r?.planoId, "free");
});

/* ---------------- Prompt 15 (17/10): base única, "cobrado à parte", tradicional justo ---------------- */
import { baseMobiliadoAno, liquidoTradicionalAnual, rentabilidadeSobreImovel } from "./simulador.ts";

const PRINT = { aluguelMensal: 3000, condoIptu: 550, contas: 350, prazoMedioMeses: 4 };

test("prompt 15 — print do simulador com 'incluídos' continua 36.000 − 10.800 − 2.160 = 23.040", () => {
  const r = simularRentabilidade({ ...PRINT, mesesOcupados: 12, condoCobranca: "incluido", contasCobranca: "incluido" }, 0.06, 0);
  assert.deepEqual(
    [r.receitaBrutaAnual, r.custosAnuais, r.comissaoAnual, r.receitaLiquidaAnual],
    [36000, 10800, 2160, 23040],
  );
});

test("prompt 15 — 'cobrado à parte' (padrão) com 12 meses: custos 0, líquida 33.840", () => {
  const r = simularRentabilidade({ ...PRINT, mesesOcupados: 12 }, 0.06, 0);
  assert.deepEqual([r.receitaBrutaAnual, r.custosAnuais, r.comissaoAnual, r.receitaLiquidaAnual], [36000, 0, 2160, 33840]);
});

test("prompt 15 — 'cobrado à parte' com 10 meses: custos 550 × 2 = 1.100, taxa 1.800, líquida 27.100", () => {
  const r = simularRentabilidade({ ...PRINT, mesesOcupados: 10 }, 0.06, 0);
  assert.deepEqual([r.receitaBrutaAnual, r.custosAnuais, r.comissaoAnual, r.receitaLiquidaAnual], [30000, 1100, 1800, 27100]);
});

test("prompt 15 — rentabilidade sobre o valor do imóvel = líquida ÷ valor", () => {
  const r = simularRentabilidade({ ...PRINT, mesesOcupados: 10, valorImovel: 450000 }, 0.06, 0);
  assert.equal(r.rentabilidadeImovel, 27100 / 450000);
  assert.equal(rentabilidadeSobreImovel(27100, undefined), null);
});

test("prompt 15 — ROI e simulador dão a MESMA líquida do mobiliado com as mesmas entradas", () => {
  const sim = simularRentabilidade({ aluguelMensal: 3000, condoIptu: 500, contas: 400, mesesOcupados: 10, prazoMedioMeses: 4 }, 0.12, 0);
  const roi = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, contasMensais: 400, condoIptu: 500 },
    0.12,
    0,
  );
  assert.equal(roi.netMobiliadoAnual, sim.receitaLiquidaAnual); // sem reposição, as duas usam baseMobiliadoAno
  assert.equal(sim.receitaLiquidaAnual, baseMobiliadoAno({ valorMensal: 3000, condoIptu: 500, contas: 400, mesesOcupados: 10 }, 0.12).liquidaAnual);
});

test("prompt 15 — ROI do print com as opções ANTIGAS continua −1.700 (19.900 × 21.600)", () => {
  const r = simularROI(
    {
      investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1,
      mesesOcupados: 10, prazoMedioMeses: 4,
      contasCobranca: "incluido", mesesVaziosTradicional: 0, taxaAdmTradicional: 0, intermediacaoACadaMeses: 0,
    },
    0.12,
    0,
  );
  assert.deepEqual([r.netMobiliadoAnual, r.netVazioAnual, r.ganhoAdicionalAnual], [19900, 21600, -1700]);
  assert.equal(Math.round((r.roiAnual ?? 0) * 100), -7);
  assert.equal(r.paybackMeses, null);
  assert.deepEqual(r.acumulado.map((a) => [a.mobiliado, a.vazio]), [[-5100, 21600], [14800, 43200], [34700, 64800]]);
});

test("prompt 15 — tradicional com os padrões: 1.800 × 11 × 0,9 = 17.820 − 1.800 × 12/30 (720) = 17.100", () => {
  assert.equal(liquidoTradicionalAnual({ valorMensal: 1800 }), 17100);
  // Com condomínio de R$ 500 no mês vazio: 17.100 − 500 = 16.600.
  assert.equal(liquidoTradicionalAnual({ valorMensal: 1800, condoIptu: 500 }), 16600);
});

test("prompt 15 — ROI com os padrões novos (contas à parte, 1 mês vazio, adm 10%, intermediação): tabela escrita", () => {
  // Mobiliado: 30.000 − 3.600 (12%) − 2.500 (reposição 10% de 25.000) − 500 × 2 (condomínio dos 2 meses vazios) = 22.900.
  // Tradicional: 16.600 (acima). Ganho: 6.300. Payback: 25.000 ÷ (6.300/12) = 47,6 → 48 meses.
  // Empate pelo valor: (16.600 + 2.500 + 1.000) ÷ (10 × 0,88) = 2.284,09 → R$ 2.285.
  // Empate pela ocupação: 3.000 × m × 0,88 − 2.500 − 500 × (12 − m) ≥ 16.600 → 3.140m ≥ 25.100 → m = 8.
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1, condoIptu: 500, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.12,
    0,
  );
  assert.deepEqual(
    { mob: r.netMobiliadoAnual, trad: r.netVazioAnual, ganho: r.ganhoAdicionalAnual, payback: r.paybackMeses, valor: r.valorMinimoEmpate, ocup: r.ocupacaoMinimaEmpate },
    { mob: 22900, trad: 16600, ganho: 6300, payback: 48, valor: 2285, ocup: 8 },
  );
  assert.equal(r.custosMobiliadoAnual, 3500);
});

test("prompt 15 — sem condomínio: mobiliado 23.900 × tradicional 17.100 = ganho 6.800 (não 2.800: contas à parte não são custo)", () => {
  const r = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.12,
    0,
  );
  assert.deepEqual([r.netMobiliadoAnual, r.netVazioAnual, r.ganhoAdicionalAnual], [23900, 17100, 6800]);
  // Com as contas como custo do proprietário (incluídas), o ganho é 19.900 − 17.100 = 2.800.
  const incl = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1, mesesOcupados: 10, prazoMedioMeses: 4, contasCobranca: "incluido" },
    0.12,
    0,
  );
  assert.equal(incl.ganhoAdicionalAnual, 2800);
});

test("prompt 15 — custo de oportunidade: acima/abaixo da aplicação só com rendimento informado", () => {
  const base = { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, mesesOcupados: 10, prazoMedioMeses: 4, contasMensais: 400, reposicaoAnualPct: 0.1 };
  assert.equal(simularROI(base, 0.12, 0).versusAplicacaoAnual, null);
  // 6.800 − 25.000 × 10% = 4.300 acima da aplicação.
  assert.equal(simularROI({ ...base, rendimentoAplicacaoPct: 0.1 }, 0.12, 0).versusAplicacaoAnual, 4300);
});

import { cenariosOcupacao } from "./simulador.ts";

test("prompt 15 — cenários de ocupação: −2 / informado / +2, presos em 6..12", () => {
  assert.deepEqual(cenariosOcupacao(10).map((c) => c.mesesOcupados), [8, 10, 12]);
  assert.deepEqual(cenariosOcupacao(12).map((c) => c.mesesOcupados), [10, 12, 12]);
  assert.deepEqual(cenariosOcupacao(6).map((c) => c.mesesOcupados), [6, 6, 8]);
  assert.deepEqual(cenariosOcupacao(3).map((c) => c.nome), ["Pessimista", "Esperado", "Otimista"]);
});

test("prompt 15 — cenários: mais meses ocupados nunca dão líquida menor (mesma base do simulador)", () => {
  const base = { valorMensal: 3000, condoIptu: 550, contas: 350 };
  const liq = cenariosOcupacao(9).map((c) => baseMobiliadoAno({ ...base, mesesOcupados: c.mesesOcupados }, 0.12).liquidaAnual);
  assert.ok(liq[0] <= liq[1] && liq[1] <= liq[2]);
});
