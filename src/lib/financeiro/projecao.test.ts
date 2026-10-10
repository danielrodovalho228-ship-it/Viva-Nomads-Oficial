/*
  Modelo financeiro (/simulacao e /roi) com as premissas reais de out/2026.
  Roda: node --test src/lib/financeiro/projecao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTO_FERRAMENTAS_POR_CONTRATO, CUSTO_FIXO_PADRAO, cenariosContratosMes, parceirosPorContrato, porContrato, projetar, receitaBrutaMensal, taxaMediaPorContrato, visaoInvestidor } from "./projecao.ts";
import { ALUGUEL_MEDIO, CONTRATOS_MES_CENARIOS, CUSTO_FIXO_FAIXA, IMPOSTO_OPCOES, IMPOSTO_SOBRE_RECEITA, MIX_FAIXAS, PARCEIROS, REFERENCIA, REPRESENTANTE_SEGUROS, SELO_POTENCIAL, TAXA_MEDIA } from "../../config/premissas-financeiras.ts";
import { FAIXAS_COMISSAO_PADRAO, taxaMediaPonderada, valorTaxa } from "../cobranca/regra.ts";

/** |real − esperado| ≤ 2% do esperado. */
const perto = (real: number, esperado: number, msg: string) =>
  assert.ok(Math.abs(real - esperado) <= Math.abs(esperado) * 0.02, `${msg}: ${real.toFixed(0)} ≠ ${esperado} (±2%)`);

test("números da regra única sobre R$ 4.320: 518,40 / 432,00 / 345,60 / 259,20 (ordem bd296d53)", () => {
  assert.equal(ALUGUEL_MEDIO, 4320);
  assert.deepEqual(FAIXAS_COMISSAO_PADRAO.slice(0, 4).map((f) => valorTaxa(4320, f.taxa)), [518.4, 432, 345.6, 259.2]);
  assert.equal(valorTaxa(4320, FAIXAS_COMISSAO_PADRAO[4].taxa), 259.2); // Plano Gestor: 6% até negociar
});

test("taxa média ponderada pelas faixas: padrão = 12%; mix misto pondera; mix vazio cai na 1ª faixa", () => {
  assert.deepEqual([...MIX_FAIXAS], [1, 0, 0, 0, 0]);
  assert.equal(TAXA_MEDIA, 0.12);
  assert.equal(taxaMediaPorContrato(), 518.4);
  assert.ok(Math.abs(taxaMediaPonderada([1, 0, 1, 0, 0]) - 0.1) < 1e-9); // metade a 12%, metade a 8%
  assert.equal(taxaMediaPonderada([]), 0.12);
  assert.equal(taxaMediaPonderada([0, 0, 0, 0, 0]), 0.12);
  assert.equal(taxaMediaPonderada([Number.NaN, -1, 0, 0, 3]), 0.06);
});

test("cenários 10/20/40 contratos por mês: ≈ R$ 5,2 mil / 10,4 mil / 20,7 mil de receita bruta", () => {
  assert.deepEqual([...CONTRATOS_MES_CENARIOS], [10, 20, 40]);
  const c = cenariosContratosMes({ operador: 0 });
  assert.deepEqual(c.map((x) => x.receita), [5184, 10368, 20736]);
  assert.equal(receitaBrutaMensal(10), 5184);
  const margem = porContrato({ operador: 0 }).margem;
  for (const x of c) assert.ok(Math.abs(x.resultado - (x.contratos * margem - CUSTO_FIXO_PADRAO)) < 0.01);
});

test("ponto de equilíbrio com o custo fixo atual (R$ 989): 3 contratos por mês", () => {
  const margem = porContrato({ operador: 0 }).margem;
  const n = Math.ceil(CUSTO_FIXO_PADRAO / margem);
  assert.equal(n, 3);
  assert.ok(n * margem >= CUSTO_FIXO_PADRAO && (n - 1) * margem < CUSTO_FIXO_PADRAO);
});

test("sem assinatura nem churn: a receita base é só a taxa de serviço dos contratos", () => {
  const p = projetar("base", { operador: 0 });
  assert.equal(p.anos[0].contratos, 54);
  assert.equal(p.anos[1].contratos, 198);
  assert.equal(p.anos[2].contratos, 342);
  for (const m of p.meses) {
    assert.equal(Math.round(m.receitaBase * 100), Math.round(m.contratos * 518.4 * 100));
    assert.ok(!("receitaAssinatura" in m) && !("assinantes" in m));
  }
  perto(p.anos[0].receita, 27994, "receita ano 1");
  perto(p.piorCaixa, -20189, "pior caixa");
  assert.equal(p.mesPrimeiroPositivo, 6);
  assert.equal(p.mesPayback, 16);
});

test("cenário Base com operador de R$ 100 por contrato: pior caixa ≈ −R$ 21 mil e payback no mês 18", () => {
  const p = projetar("base", { operador: 100 });
  perto(p.piorCaixa, -20992, "pior caixa com operador");
  assert.equal(p.mesPayback, 18);
});

test("por contrato: receita = R$ 518,40; margem ≈ R$ 471 e empate de 4 a 6 contratos/mês (5 a 7 com operador)", () => {
  const sem = porContrato({ operador: 0 });
  assert.equal(Math.round(sem.receita * 100) / 100, 518.4);
  assert.equal(Math.round(sem.margem), 471);
  assert.deepEqual(sem.empate.map((x) => Math.ceil(x)), [4, 6]);
  assert.deepEqual(porContrato({ operador: 100 }).empate.map((x) => Math.ceil(x)), [5, 7]);
});

test("cenários ordenados: otimista se paga antes do base e do pessimista", () => {
  const pes = projetar("pessimista", { operador: 0 });
  const base = projetar("base", { operador: 0 });
  const oti = projetar("otimista", { operador: 0 });
  assert.ok(oti.mesPayback! < base.mesPayback! && base.mesPayback! < pes.mesPayback!);
  assert.ok(oti.piorCaixa > base.piorCaixa && base.piorCaixa > pes.piorCaixa);
});

test("premissas: fixo R$ 989 (faixa até R$ 1.450), ferramentas R$ 16/contrato, referência out/2026", () => {
  assert.equal(CUSTO_FIXO_PADRAO, 989);
  assert.equal(CUSTO_FIXO_FAIXA.min, CUSTO_FIXO_PADRAO);
  assert.equal(CUSTO_FIXO_FAIXA.max, 1450);
  assert.equal(CUSTO_FERRAMENTAS_POR_CONTRATO, 16);
  assert.equal(REFERENCIA, "out/2026");
});

test("modelo único: nenhum plano Gratuito/Essencial/Profissional nem Fundadores nas premissas", async () => {
  const premissas = await import("../../config/premissas-financeiras.ts");
  for (const k of ["FUNDADORES", "ASSINATURA", "MIX_PLANOS", "COMISSAO"]) assert.ok(!(k in premissas), `${k} não deveria existir`);
});

test("parceiros: todos desligados por padrão = receita base (só a taxa de serviço)", () => {
  const base = projetar("base", { operador: 0 });
  const vazio = projetar("base", { operador: 0, parceiros: [] });
  assert.deepEqual(vazio.anos, base.anos);
  for (const m of base.meses) {
    assert.equal(m.receitaParceiros, 0);
    assert.equal(Math.round(m.receita * 100), Math.round(m.receitaTaxa * 100));
  }
});

const TODOS = PARCEIROS.map((p) => p.id);

test("parceiros: todos ligados no Base ≈ R$ 38,87 por contrato antes do imposto (seguros a 10% do prêmio)", () => {
  assert.equal(REPRESENTANTE_SEGUROS.padrao, 0.1);
  assert.equal(Math.round(parceirosPorContrato({ operador: 0, parceiros: TODOS }) * 100) / 100, 38.87);
  const p = projetar("base", { operador: 0, parceiros: TODOS });
  const m = p.meses[20]; // mês 21: todos já começaram
  assert.equal(Math.round(m.receitaParceiros * 100) / 100, Math.round(m.contratos * 38.87 * 100) / 100);
  perto(p.anos[2].receitaParceiros, 13294, "parceiros ano 3");
  perto(p.piorCaixa, -20120, "pior caixa com parceiros");
  assert.equal(p.mesPayback, 15);
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

test("imposto da Viva: padrão 6%; anexo V (15,5%) → margem ≈ R$ 422 e empate de 5 a 6 contratos/mês (6 a 8 com operador)", () => {
  assert.deepEqual([...IMPOSTO_OPCOES], [0.06, 0.155]);
  assert.equal(IMPOSTO_SOBRE_RECEITA, 0.06);
  const v = porContrato({ operador: 0, imposto: 0.155 });
  assert.equal(Math.round(v.margem), 422);
  assert.deepEqual(v.empate.map((x) => Math.ceil(x)), [5, 6]);
  assert.deepEqual(porContrato({ operador: 100, imposto: 0.155 }).empate.map((x) => Math.ceil(x)), [6, 8]);
  assert.equal(porContrato({ operador: 0 }).margem, porContrato({ operador: 0, imposto: 0.06 }).margem);
  assert.ok(projetar("base", { operador: 0, imposto: 0.155 }).piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});
