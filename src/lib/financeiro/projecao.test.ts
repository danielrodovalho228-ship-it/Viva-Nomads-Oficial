/*
  Modelo financeiro (/simulacao e /roi) com as premissas reais de out/2026.
  Roda: node --test src/lib/financeiro/projecao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { comissaoMediaPorContrato, CUSTO_FERRAMENTAS_POR_CONTRATO, CUSTO_FIXO_PADRAO, parceirosPorContrato, porContrato, projetar, visaoInvestidor } from "./projecao.ts";
import { CUSTO_FIXO_FAIXA, FUNDADORES, IMPOSTO_OPCOES, IMPOSTO_SOBRE_RECEITA, PARCEIROS, REFERENCIA, REPRESENTANTE_SEGUROS, SELO_POTENCIAL } from "../../config/premissas-financeiras.ts";
import { COMISSAO_POR_PLANO } from "../../config/planos.ts";

/** |real − esperado| ≤ 2% do esperado. */
const perto = (real: number, esperado: number, msg: string) =>
  assert.ok(Math.abs(real - esperado) <= Math.abs(esperado) * 0.02, `${msg}: ${real.toFixed(0)} ≠ ${esperado} (±2%)`);

// Receita base = comissão + assinaturas (sem seguro incêndio desde financeiro/parceiros-investidor).
test("cenário Base sem operador: ano 1 = 54 contratos e ≈ R$ 11,1 mil; pior caixa ≈ −R$ 25,7 mil; payback no mês 26", () => {
  const p = projetar("base", { operador: 0 });
  assert.equal(p.anos[0].contratos, 54);
  assert.equal(p.anos[1].contratos, 198);
  assert.equal(p.anos[2].contratos, 342);
  perto(p.anos[0].receita, 11143, "receita ano 1");
  perto(p.anos[1].receita, 56231, "receita ano 2");
  perto(p.anos[2].receita, 94358, "receita ano 3");
  perto(p.piorCaixa, -25711, "pior caixa");
  assert.equal(p.mesPrimeiroPositivo, 12);
  assert.equal(p.mesPayback, 26);
});

test("cenário Base com operador de R$ 100: pior caixa ≈ −R$ 33,8 mil e não se paga em 36 meses", () => {
  const p = projetar("base", { operador: 100 });
  perto(p.piorCaixa, -33816, "pior caixa com operador");
  assert.equal(p.mesPayback, null);
});

test("por contrato: receita = comissão média R$ 225,60; margem ≈ R$ 196 e empate de 10 a 13 contratos/mês (19 a 27 com operador)", () => {
  const sem = porContrato({ operador: 0 });
  assert.equal(Math.round(comissaoMediaPorContrato() * 100) / 100, 225.6); // 50% × 288 + 35% × 192 + 15% × 96
  assert.equal(Math.round(sem.receita * 100) / 100, 225.6);
  assert.equal(Math.round(sem.margem), 196);
  assert.deepEqual(sem.empate.map((x) => Math.ceil(x)), [10, 13]);
  const com = porContrato({ operador: 100 });
  assert.deepEqual(com.empate.map((x) => Math.ceil(x)), [19, 27]);
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

test("parceiros: todos desligados por padrão = receita base (comissão + assinaturas)", () => {
  const base = projetar("base", { operador: 0 });
  const vazio = projetar("base", { operador: 0, parceiros: [] });
  assert.deepEqual(vazio.anos, base.anos);
  for (const m of base.meses) {
    assert.equal(m.receitaParceiros, 0);
    assert.equal(Math.round(m.receita * 100), Math.round((m.receitaComissao + m.receitaAssinatura) * 100));
  }
});

const TODOS = PARCEIROS.map((p) => p.id);

test("parceiros: todos ligados no Base ≈ R$ 34 por contrato antes do imposto (seguros a 10% do prêmio)", () => {
  assert.equal(REPRESENTANTE_SEGUROS.padrao, 0.1);
  assert.equal(Math.round(parceirosPorContrato({ operador: 0, parceiros: TODOS }) * 100) / 100, 34.07);
  const p = projetar("base", { operador: 0, parceiros: TODOS });
  const m = p.meses[20]; // mês 21: todos já começaram
  assert.equal(Math.round(m.receitaParceiros * 100) / 100, Math.round(m.contratos * 34.07 * 100) / 100);
  perto(p.anos[2].receitaParceiros, 11652, "parceiros ano 3");
  perto(p.piorCaixa, -24937, "pior caixa com parceiros");
  assert.equal(p.mesPayback, 24);
});

test("parceiro com início no mês 13 não soma nada no ano 1", () => {
  const carro = PARCEIROS.find((p) => p.id === "carro")!;
  assert.equal(carro.mesInicio, 13);
  const p = projetar("base", { operador: 0, parceiros: ["carro"] });
  assert.equal(p.anos[0].receitaParceiros, 0);
  assert.ok(p.anos[1].receitaParceiros > 0);
});

test("seguros como representante: 0% = zero; acima de 15% é limitado a 15%", () => {
  const seguros = PARCEIROS.filter((p) => p.tipo === "seguro").map((p) => p.id);
  assert.equal(parceirosPorContrato({ operador: 0, parceiros: seguros, pctSeguro: 0 }), 0);
  assert.equal(
    parceirosPorContrato({ operador: 0, parceiros: seguros, pctSeguro: 0.5 }),
    parceirosPorContrato({ operador: 0, parceiros: seguros, pctSeguro: 0.15 })
  );
  assert.match(REPRESENTANTE_SEGUROS.texto, /Res\. CNSP 431\/2021/);
  assert.match(REPRESENTANTE_SEGUROS.aviso, /sem contrato fechado/);
});

test("visão do investidor: com e sem operador, receita total = base + parceiros, selo fixo", () => {
  const v = visaoInvestidor("base", { parceiros: TODOS });
  assert.deepEqual(v.map((x) => x.operador), [0, 100]);
  for (const linha of v) for (const a of linha.anos) assert.ok(Math.abs(a.receita - (a.receitaBase + a.receitaParceiros)) < 0.01);
  assert.equal(SELO_POTENCIAL, "Potencial — parcerias sem contrato assinado não são receita garantida");
  assert.ok(PARCEIROS.every((p) => p.status !== ("contratado" as string)));
});

test("custo fixo editável muda o resultado (faixa alta piora o caixa)", () => {
  const alto = projetar("base", { operador: 0, custoFixo: CUSTO_FIXO_FAIXA.max });
  assert.ok(alto.piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});

test("imposto da Viva: padrão 6%; anexo V (15,5%) → margem ≈ R$ 174 e empate de 11 a 15 (25 a 34 com operador)", () => {
  assert.deepEqual([...IMPOSTO_OPCOES], [0.06, 0.155]);
  assert.equal(IMPOSTO_SOBRE_RECEITA, 0.06);
  const v = porContrato({ operador: 0, imposto: 0.155 });
  assert.equal(Math.round(v.margem), 174);
  assert.deepEqual(v.empate.map((x) => Math.ceil(x)), [11, 15]);
  assert.deepEqual(porContrato({ operador: 100, imposto: 0.155 }).empate.map((x) => Math.ceil(x)), [25, 34]);
  assert.equal(porContrato({ operador: 0 }).margem, porContrato({ operador: 0, imposto: 0.06 }).margem);
  assert.ok(projetar("base", { operador: 0, imposto: 0.155 }).piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});
