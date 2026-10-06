/*
  Modelo financeiro (/simulacao e /roi) com as premissas reais de out/2026.
  Roda: node --test src/lib/financeiro/projecao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { comissaoMediaPorContrato, CUSTO_FERRAMENTAS_POR_CONTRATO, CUSTO_FIXO_PADRAO, porContrato, projetar } from "./projecao.ts";
import { CUSTO_FIXO_FAIXA, FUNDADORES, IMPOSTO_OPCOES, IMPOSTO_SOBRE_RECEITA, RECEITAS_FUTURAS, REFERENCIA, SEGURO_INCENDIO } from "../../config/premissas-financeiras.ts";
import { COMISSAO_POR_PLANO } from "../../config/planos.ts";

/** |real − esperado| ≤ 2% do esperado. */
const perto = (real: number, esperado: number, msg: string) =>
  assert.ok(Math.abs(real - esperado) <= Math.abs(esperado) * 0.02, `${msg}: ${real.toFixed(0)} ≠ ${esperado} (±2%)`);

test("cenário Base sem operador: ano 1 = 54 contratos e ≈ R$ 12,5 mil; pior caixa ≈ −R$ 25,2 mil", () => {
  const p = projetar("base", { operador: 0 });
  assert.equal(p.anos[0].contratos, 54);
  assert.equal(p.anos[1].contratos, 198);
  assert.equal(p.anos[2].contratos, 342);
  perto(p.anos[0].receita, 12503, "receita ano 1");
  perto(p.anos[1].receita, 64151, "receita ano 2");
  perto(p.anos[2].receita, 108038, "receita ano 3");
  perto(p.piorCaixa, -25180, "pior caixa");
  assert.equal(p.mesPrimeiroPositivo, 10);
});

test("cenário Base com operador de R$ 100: pior caixa ≈ −R$ 30,8 mil", () => {
  perto(projetar("base", { operador: 100 }).piorCaixa, -30828, "pior caixa com operador");
});

test("por contrato: receita ≈ R$ 265,60, margem ≈ R$ 233 (sem operador) e empate de 8 a 11 contratos/mês", () => {
  const sem = porContrato({ operador: 0 });
  assert.equal(Math.round(comissaoMediaPorContrato() * 100) / 100, 225.6); // 50% × 288 + 35% × 192 + 15% × 96
  assert.equal(Math.round(sem.receita * 100) / 100, 265.6);
  assert.equal(Math.round(sem.margem), 233);
  assert.deepEqual(sem.empate.map((x) => Math.ceil(x)), [8, 11]);
  const com = porContrato({ operador: 100 });
  assert.deepEqual(com.empate.map((x) => Math.ceil(x)), [14, 19]);
});

test("cenários ordenados: pessimista não se paga em 36 meses; otimista se paga antes do base", () => {
  const pes = projetar("pessimista", { operador: 0 });
  const base = projetar("base", { operador: 0 });
  const oti = projetar("otimista", { operador: 0 });
  assert.equal(pes.mesPayback, null);
  assert.ok(oti.mesPayback! < base.mesPayback!);
  assert.ok(oti.piorCaixa > base.piorCaixa && base.piorCaixa > pes.piorCaixa);
});

test("premissas: fixo R$ 989 (faixa até R$ 1.450), ferramentas R$ 16,50/contrato, referência out/2026", () => {
  assert.equal(CUSTO_FIXO_PADRAO, 989);
  assert.equal(CUSTO_FIXO_FAIXA.min, CUSTO_FIXO_PADRAO);
  assert.equal(CUSTO_FIXO_FAIXA.max, 1450);
  assert.equal(CUSTO_FERRAMENTAS_POR_CONTRATO, 16.5);
  assert.equal(REFERENCIA, "out/2026");
});

test("comissões vêm de config/planos.ts; Fundador paga a do Profissional", () => {
  assert.deepEqual(COMISSAO_POR_PLANO, { free: 0.12, essential: 0.08, pro: 0.04, gestor: 0 });
  assert.equal(FUNDADORES.comissao, COMISSAO_POR_PLANO.pro);
  assert.equal(FUNDADORES.quantidade, 20);
});

test("receitas que não existem hoje ficam desligadas e fora da conta", () => {
  assert.ok(RECEITAS_FUTURAS.length >= 3);
  assert.ok(RECEITAS_FUTURAS.every((r) => r.ligada === false));
  const m = projetar("base", { operador: 0 }).meses[11];
  assert.equal(Math.round(m.receita), Math.round(m.receitaComissao + m.receitaAssinatura + m.receitaSeguro));
});

test("custo fixo editável muda o resultado (faixa alta piora o caixa)", () => {
  const alto = projetar("base", { operador: 0, custoFixo: CUSTO_FIXO_FAIXA.max });
  assert.ok(alto.piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});

test("imposto da Viva: padrão 6%; anexo V (15,5%) → margem ≈ R$ 208 e empate de 9 a 12 (17 a 24 com operador)", () => {
  assert.deepEqual([...IMPOSTO_OPCOES], [0.06, 0.155]);
  assert.equal(IMPOSTO_SOBRE_RECEITA, 0.06);
  const v = porContrato({ operador: 0, imposto: 0.155 });
  assert.equal(Math.round(v.margem), 208);
  assert.deepEqual(v.empate.map((x) => Math.ceil(x)), [9, 12]);
  assert.deepEqual(porContrato({ operador: 100, imposto: 0.155 }).empate.map((x) => Math.ceil(x)), [17, 24]);
  // O padrão continua sendo 6%: os números travados acima não mudam.
  assert.equal(porContrato({ operador: 0 }).margem, porContrato({ operador: 0, imposto: 0.06 }).margem);
  assert.ok(projetar("base", { operador: 0, imposto: 0.155 }).piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});

test("seguro incêndio traz o aviso do modelo com a seguradora", () => {
  assert.match(SEGURO_INCENDIO.aviso, /corretor SUSEP ou representante/);
});
