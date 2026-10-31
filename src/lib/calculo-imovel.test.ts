/*
  E294 — Simulador de rentabilidade + Calculadora de ROI num cálculo só, só com os números do dono ("a Viva só
  conecta"). Nada de valor de exemplo nem de padrão de mercado: tudo começa vazio, campo vazio vale 0, e o tradicional
  só entra com o valor mensal dele digitado.
  Roda: node --test src/lib/calculo-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularImovel, cenariosDoDono, entradaVazia, type EntradaImovel } from "./calculo-imovel.ts";
import { liquidoTradicionalAnual, simularROI, simularRentabilidade } from "./simulador.ts";

const TELA = readFileSync(new URL("../app/(dashboard)/dashboard/simulador/page.tsx", import.meta.url), "utf8");
const com = (p: Partial<EntradaImovel>): EntradaImovel => ({ ...entradaVazia(), ...p, tradicional: { ...entradaVazia().tradicional, ...(p.tradicional ?? {}) } });

test("vazio: sem valor mensal e meses ocupados não há resultado, comparação nem cenários", () => {
  const r = calcularImovel(entradaVazia(), 0.12);
  assert.equal(r.pronto, false);
  assert.equal(r.comparacao, null);
  assert.deepEqual(r.cenarios, []);
  assert.equal(calcularImovel(com({ valorMensal: 3000 }), 0.12).pronto, false);
  assert.equal(calcularImovel(com({ mesesOcupados: 10 }), 0.12).pronto, false);
});

test("um cálculo: a rentabilidade e o mobiliado da comparação são a mesma conta, com os números digitados (Muse: 23.900)", () => {
  const e = com({ valorMensal: 3000, mesesOcupados: 10, contas: 400, investimentoMobilia: 25000, reposicaoPct: 10, tradicional: { valorMensal: 1800, mesesVazios: 1, taxaAdmPct: 10, intermediacaoACadaMeses: 30 } });
  const r = calcularImovel(e, 0.12);
  assert.equal(r.pronto, true);
  assert.equal(r.rentabilidade.receitaLiquidaAnual, 23900);
  assert.equal(r.comparacao!.netMobiliadoAnual, r.rentabilidade.receitaLiquidaAnual);
  // O tradicional usa EXATAMENTE os números digitados.
  assert.equal(r.comparacao!.netVazioAnual, liquidoTradicionalAnual({ valorMensal: 1800, mesesVazios: 1, taxaAdm: 0.1, intermediacaoACadaMeses: 30 }));
  const direto = simularROI({ investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1, mesesOcupados: 10, prazoMedioMeses: 1, mesesVaziosTradicional: 1, taxaAdmTradicional: 0.1, intermediacaoACadaMeses: 30 }, 0.12, 0);
  assert.equal(r.comparacao!.ganhoAdicionalAnual, direto.ganhoAdicionalAnual);
  assert.equal(r.comparacao!.paybackMeses, direto.paybackMeses);
});

test("sem padrão de mercado: campos do tradicional vazios valem 0 (não 1 mês vazio, 10% e 1 a cada 30)", () => {
  const r = calcularImovel(com({ valorMensal: 3000, mesesOcupados: 10, tradicional: { valorMensal: 1800, mesesVazios: 0, taxaAdmPct: 0, intermediacaoACadaMeses: 0 } }), 0.12);
  assert.equal(r.comparacao!.netVazioAnual, 1800 * 12);
  // Sem o valor mensal do tradicional, nenhuma comparação (nada é inventado para o lado de lá).
  assert.equal(calcularImovel(com({ valorMensal: 3000, mesesOcupados: 10, tradicional: { valorMensal: 0, mesesVazios: 1, taxaAdmPct: 10, intermediacaoACadaMeses: 30 } }), 0.12).comparacao, null);
});

test("reposição, prazo e cenários vêm do dono: sem investimento, reposição zero; sem prazo, sem contratos/ano; cenários em 1..12", () => {
  const r = calcularImovel(com({ valorMensal: 3000, mesesOcupados: 4, reposicaoPct: 10 }), 0.12);
  assert.equal(r.rentabilidade.reposicaoAnual, 0);
  assert.equal(r.contratosPorAno, null);
  assert.equal(calcularImovel(com({ valorMensal: 3000, mesesOcupados: 8, prazoMedioMeses: 4 }), 0.12).contratosPorAno, 2);
  assert.deepEqual(cenariosDoDono(4).map((c) => c.mesesOcupados), [2, 4, 6]);
  assert.deepEqual(cenariosDoDono(1).map((c) => c.mesesOcupados), [1, 1, 3]);
  assert.deepEqual(cenariosDoDono(12).map((c) => c.mesesOcupados), [10, 12, 12]);
  assert.deepEqual(r.cenarios.map((c) => c.mesesOcupados), [2, 4, 6]);
  assert.equal(r.cenarios[1].liquidaAnual, simularRentabilidade({ aluguelMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 4, prazoMedioMeses: 1 }, 0.12, 0).receitaLiquidaAnual);
});

test("a tela: começa vazia, sem padrão de mercado nem valor de exemplo, e mostra a conta só com os números digitados", () => {
  assert.match(TELA, /useState<EntradaImovel>\(entradaVazia\)/);
  assert.match(TELA, /calcularImovel\(e, faixa\.taxa\)/);
  assert.doesNotMatch(TELA, /PADROES_TRADICIONAL|useState\((3000|550|350|25000|1800|400|10)\)/);
  assert.match(TELA, /data-testid="sim-vazio"/);
  assert.match(TELA, /data-testid="roi-sem-tradicional"/);
  assert.match(TELA, /vazioQuandoZero testid="sim-valor-mensal"/);
  assert.match(TELA, /vazioQuandoZero testid="roi-valor-tradicional"/);
});
