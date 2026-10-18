/*
  Modelo financeiro (/simulacao e /roi) com as premissas reais de out/2026.
  Roda: node --test src/lib/financeiro/projecao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparativoRegraComissao, mesesContratoValidos, CUSTO_FERRAMENTAS_POR_CONTRATO, CUSTO_FIXO_PADRAO, cenariosContratosMes, parceirosPorContrato, porContrato, projetar, receitaBrutaMensal, taxaMediaPorContrato, visaoInvestidor } from "./projecao.ts";
import { ALUGUEL_MEDIO, MESES_MEDIOS_CONTRATO, CONTRATOS_MES_CENARIOS, CUSTOS_FIXOS, CUSTO_FIXO_FAIXA, IMPOSTO_OPCOES, IMPOSTO_SOBRE_RECEITA, MIX_FAIXAS, PARCEIROS, REFERENCIA, REPRESENTANTE_SEGUROS, SELO_POTENCIAL, TAXA_MEDIA } from "../../config/premissas-financeiras.ts";
import { FAIXAS_COMISSAO_PADRAO, taxaMediaPonderada, comissaoSobreContrato } from "../cobranca/regra.ts";

/** |real − esperado| ≤ 2% do esperado. */
const perto = (real: number, esperado: number, msg: string) =>
  assert.ok(Math.abs(real - esperado) <= Math.abs(esperado) * 0.02, `${msg}: ${real.toFixed(0)} ≠ ${esperado} (±2%)`);

test("números da regra única sobre R$ 4.320 em 1 mês: 518,40 / 432,00 / 345,60 / 259,20 (ordem bd296d53)", () => {
  assert.equal(ALUGUEL_MEDIO, 4320);
  assert.deepEqual(FAIXAS_COMISSAO_PADRAO.slice(0, 4).map((f) => comissaoSobreContrato(4320, 1, f.taxa)), [518.4, 432, 345.6, 259.2]);
  assert.equal(comissaoSobreContrato(4320, 1, FAIXAS_COMISSAO_PADRAO[4].taxa), 259.2); // Plano Gestor: 6% até negociar
});

test("taxa sobre o valor TOTAL (ordem 5df28a7b): R$ 3.000 a 12% = 360 (1 mês), 720 (2 meses), 1.080 (3 meses); não é mais o 1º mês", () => {
  assert.deepEqual([1, 2, 3].map((m) => comissaoSobreContrato(3000, m, 0.12)), [360, 720, 1080]);
  assert.equal(MESES_MEDIOS_CONTRATO, 3);
  assert.equal(taxaMediaPorContrato(3000, 3), 1080);
  assert.equal(taxaMediaPorContrato(3000, 1), 360);
  assert.equal(taxaMediaPorContrato(), 1555.2); // 4.320 × 3 meses × 12%
  assert.notEqual(taxaMediaPorContrato(), 518.4);
  assert.equal(taxaMediaPorContrato(3000, 0), 0); // duração inválida não inventa receita
  assert.equal(taxaMediaPorContrato(0, 3), 0);
});

test("taxa média ponderada pelas faixas: padrão = 12%; mix misto pondera; mix vazio cai na 1ª faixa", () => {
  assert.deepEqual([...MIX_FAIXAS], [1, 0, 0, 0, 0]);
  assert.equal(TAXA_MEDIA, 0.12);
  assert.equal(taxaMediaPorContrato(), 1555.2);
  assert.ok(Math.abs(taxaMediaPonderada([1, 0, 1, 0, 0]) - 0.1) < 1e-9); // metade a 12%, metade a 8%
  assert.equal(taxaMediaPonderada([]), 0.12);
  assert.equal(taxaMediaPonderada([0, 0, 0, 0, 0]), 0.12);
  assert.equal(taxaMediaPonderada([Number.NaN, -1, 0, 0, 3]), 0.06);
});

test("cenários 10/20/40 contratos por mês: ≈ R$ 15,6 mil / 31,1 mil / 62,2 mil de receita bruta", () => {
  assert.deepEqual([...CONTRATOS_MES_CENARIOS], [10, 20, 40]);
  const c = cenariosContratosMes({ operador: 0 });
  assert.deepEqual(c.map((x) => x.receita), [15552, 31104, 62208]);
  assert.equal(receitaBrutaMensal(10), 15552);
  const margem = porContrato({ operador: 0 }).margem;
  for (const x of c) assert.ok(Math.abs(x.resultado - (x.contratos * margem - CUSTO_FIXO_PADRAO)) < 0.01);
});

test("ponto de equilíbrio com o custo fixo atual (≈ R$ 6 mil com pró-labore): 5 contratos por mês, só custo fixo", () => {
  const margem = porContrato({ operador: 0 }).margem;
  const n = Math.ceil(CUSTO_FIXO_PADRAO / margem);
  assert.equal(n, 5);
  assert.ok(n * margem >= CUSTO_FIXO_PADRAO && (n - 1) * margem < CUSTO_FIXO_PADRAO);
});

test("sem assinatura nem churn: a receita base é só a taxa de serviço dos contratos", () => {
  const p = projetar("base", { operador: 0 });
  assert.equal(p.anos[0].contratos, 54);
  assert.equal(p.anos[1].contratos, 198);
  assert.equal(p.anos[2].contratos, 342);
  for (const m of p.meses) {
    assert.equal(Math.round(m.receitaBase * 100), Math.round(m.contratos * 1555.2 * 100));
    assert.ok(!("receitaAssinatura" in m) && !("assinantes" in m));
  }
  perto(p.anos[0].receita, 83981, "receita ano 1");
  perto(p.piorCaixa, -41321, "pior caixa");
  assert.equal(p.mesPrimeiroPositivo, 7);
  assert.equal(p.mesPayback, 14);
});

test("cenário Base com operador de R$ 100 por contrato: pior caixa ≈ −R$ 42 mil e payback no mês 15 (com pró-labore)", () => {
  const p = projetar("base", { operador: 100 });
  perto(p.piorCaixa, -42281, "pior caixa com operador");
  assert.equal(p.mesPayback, 15);
});

test("por contrato: receita = R$ 1.555,20; margem ≈ R$ 1.446 e empate de 5 a 6 contratos/mês (6 com operador)", () => {
  const sem = porContrato({ operador: 0 });
  assert.equal(Math.round(sem.receita * 100) / 100, 1555.2);
  assert.equal(Math.round(sem.margem), 1446);
  assert.deepEqual(sem.empate.map((x) => Math.ceil(x)), [5, 6]);
  assert.deepEqual(porContrato({ operador: 100 }).empate.map((x) => Math.ceil(x)), [6, 6]);
});

test("cenários ordenados: otimista se paga antes do base; o pessimista se paga mais tarde ainda", () => {
  const pes = projetar("pessimista", { operador: 0 });
  const base = projetar("base", { operador: 0 });
  const oti = projetar("otimista", { operador: 0 });
  assert.equal(oti.mesPayback, 10);
  assert.equal(base.mesPayback, 14);
  assert.equal(pes.mesPayback, 29);
  assert.ok(oti.piorCaixa > base.piorCaixa && base.piorCaixa > pes.piorCaixa);
});

test("premissas: fixo ≈ R$ 6 mil (R$ 989 de ferramentas + R$ 5.000 de pró-labore), ferramentas R$ 16/contrato, referência out/2026", () => {
  assert.equal(CUSTO_FIXO_PADRAO, 5989);
  assert.ok(CUSTOS_FIXOS.some((c) => c.rotulo === "Pró-labore dos sócios" && c.valor === 5000));
  assert.equal(CUSTO_FIXO_FAIXA.texto, "≈ R$ 6 mil/mês com pró-labore");
  assert.ok(CUSTO_FIXO_FAIXA.min <= 989 && CUSTO_FIXO_FAIXA.max >= CUSTO_FIXO_PADRAO, "o controle deslizante precisa cobrir o padrão");
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
  perto(p.piorCaixa, -41187, "pior caixa com parceiros");
  assert.equal(p.mesPayback, 14);
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

test("imposto da Viva: padrão 6%; anexo V (15,5%) → margem ≈ R$ 1.298 e empate de 6 contratos/mês (6 a 7 com operador)", () => {
  assert.deepEqual([...IMPOSTO_OPCOES], [0.06, 0.155]);
  assert.equal(IMPOSTO_SOBRE_RECEITA, 0.06);
  const v = porContrato({ operador: 0, imposto: 0.155 });
  assert.equal(Math.round(v.margem), 1298);
  assert.deepEqual(v.empate.map((x) => Math.ceil(x)), [6, 6]);
  assert.deepEqual(porContrato({ operador: 100, imposto: 0.155 }).empate.map((x) => Math.ceil(x)), [6, 7]);
  assert.equal(porContrato({ operador: 0 }).margem, porContrato({ operador: 0, imposto: 0.06 }).margem);
  assert.ok(projetar("base", { operador: 0, imposto: 0.155 }).piorCaixa < projetar("base", { operador: 0 }).piorCaixa);
});

test("duração média do contrato editável (ordem 5df28a7b): entra na receita; valor inválido volta ao padrão", () => {
  assert.equal(mesesContratoValidos("2"), 2);
  assert.equal(mesesContratoValidos("abc"), MESES_MEDIOS_CONTRATO);
  assert.equal(mesesContratoValidos("0"), MESES_MEDIOS_CONTRATO);
  assert.equal(mesesContratoValidos("13"), MESES_MEDIOS_CONTRATO);
  assert.equal(mesesContratoValidos("1.5"), MESES_MEDIOS_CONTRATO);
  assert.equal(mesesContratoValidos(undefined), MESES_MEDIOS_CONTRATO);
  const base = { operador: 0 };
  const r1 = porContrato({ ...base, mesesContrato: 1 }).receita;
  const r3 = porContrato({ ...base, mesesContrato: 3 }).receita;
  assert.ok(Math.abs(r3 - 3 * r1) < 0.01);
  assert.equal(porContrato(base).receita, r3); // padrão = 3 meses
  const a1 = projetar("base", { ...base, mesesContrato: 1 }).anos[0].receitaBase;
  const a3 = projetar("base", { ...base, mesesContrato: 3 }).anos[0].receitaBase;
  assert.ok(a3 > a1 && Math.abs(a3 - 3 * a1) < 1);
});

test("regra antiga (1º mês) × nova (valor total) lado a lado", () => {
  const c = comparativoRegraComissao(3, 3000, 0.12);
  assert.deepEqual(c, { meses: 3, regraAntiga: 360, regraNova: 1080, diferenca: 720 });
  assert.equal(comparativoRegraComissao(1, 3000, 0.12).diferenca, 0); // 1 mês: as regras coincidem
  assert.equal(comparativoRegraComissao(99, 3000, 0.12).meses, MESES_MEDIOS_CONTRATO); // inválido → padrão
});

// ── Prompt 21: receitas adicionais, ROI e "de onde vem cada contrato" ────────
import { roi, receitaPorContrato, FONTES } from "./projecao.ts";
import { RECEITAS_ADICIONAIS, VERIFICACAO, SAIDA_DONOS_MES, FUNDADORES_REGRA, CENARIOS, INVESTIMENTO_INICIAL, CUSTOS_POR_CONTRATO, RODAPE_SOCIOS, SELO_PARECER } from "../../config/premissas-financeiras.ts";

const BASE = { operador: 0 };

test("p21 — tudo desligado: números idênticos aos de hoje (regressão) e todas as fontes novas em zero", () => {
  const hoje = projetar("base", BASE);
  const novo = projetar("base", { ...BASE, extras: [], ajustes: {}, fatorAdesao: 1 });
  assert.deepEqual(novo.meses.map((m) => m.caixa), hoje.meses.map((m) => m.caixa));
  assert.equal(novo.mesPayback, 14);
  perto(novo.piorCaixa, -41321, "pior caixa");
  for (const m of novo.meses) {
    for (const k of ["receitaVerificacao", "receitaB2B", "receitaPublicamos", "receitaFerramentas", "descontoFundadores"] as const) assert.equal(m[k], 0, k);
    assert.ok(Math.abs(m.receita - (m.receitaTaxa + m.receitaSeguros + m.receitaServicos)) < 1e-6);
  }
  assert.ok(RECEITAS_ADICIONAIS.every((e) => e.natureza === "desconto" || e.adesao > 0));
});

test("p21 — cada fonte ligada isolada soma o esperado no mês de início e zero antes", () => {
  const base = projetar("base", BASE);
  const c = (m: number) => base.meses[m - 1].contratos;
  const donosNovos = CENARIOS.base.donosNovosMes;
  const casos: [string, keyof (typeof base.meses)[0], number, (m: number) => number][] = [
    ["verificacao_inquilino", "receitaVerificacao", 6, (m) => c(m) * VERIFICACAO.candidatosPorContrato * 0.4 * 44],
    ["b2b_alocacao", "receitaB2B", 9, (m) => c(m) * 0.15 * 300],
    ["publicamos_pago", "receitaPublicamos", 4, () => donosNovos * 0.2 * 150],
  ];
  for (const [id, campo, inicio, esperado] of casos) {
    const p = projetar("base", { ...BASE, extras: [id] });
    assert.equal(p.meses[inicio - 2][campo], 0, `${id} antes do início`);
    assert.ok(Math.abs((p.meses[inicio - 1][campo] as number) - esperado(inicio)) < 1e-6, `${id} no mês ${inicio}`);
    assert.ok(Math.abs(p.meses[inicio - 1].receita - (base.meses[inicio - 1].receita + esperado(inicio))) < 1e-6);
  }
});

test("p21 — verificação desconta o custo da CAF no custo variável", () => {
  const sem = projetar("base", BASE).meses[9];
  const com = projetar("base", { ...BASE, extras: ["verificacao_inquilino"] }).meses[9];
  const verificacoes = com.contratos * VERIFICACAO.candidatosPorContrato * 0.4;
  const custoEsperado = sem.custoVariavel + verificacoes * VERIFICACAO.custoCaf + 0.06 * com.receitaVerificacao;
  assert.ok(Math.abs(com.custoVariavel - custoEsperado) < 1e-6);
  assert.equal(VERIFICACAO.custoCaf, 8);
});

test("p21 — ferramentas: assinantes acumulam sobre os donos ativos com saída de 3% ao mês (só a partir do mês 12)", () => {
  const p = projetar("base", { ...BASE, extras: ["ferramentas_fora"] });
  let ativos = 0;
  for (const m of p.meses) {
    ativos = ativos * (1 - SAIDA_DONOS_MES) + CENARIOS.base.donosNovosMes;
    assert.ok(Math.abs(m.donosAtivos - ativos) < 1e-9);
    const esperado = m.m >= 12 ? ativos * 0.05 * 39 : 0;
    assert.ok(Math.abs(m.receitaFerramentas - esperado) < 1e-9, `mês ${m.m}`);
  }
  assert.ok(p.meses[35].receitaFerramentas > p.meses[12].receitaFerramentas, "recorrente cresce com a base");
});

test("p21 — fundadores reduzem a taxa só para os 50 primeiros donos e só por 6 meses", () => {
  const sem = projetar("base", BASE);
  const com = projetar("base", { ...BASE, extras: ["fundadores"] });
  // 5 donos novos/mês a partir do mês 4 → 50 fundadores entram nos meses 4..13; o último sai da janela no mês 18.
  assert.equal(com.meses[2].descontoFundadores, 0);
  assert.ok(com.meses[3].descontoFundadores < 0);
  const ultimoMesComDesconto = Math.max(...com.meses.filter((m) => m.descontoFundadores < 0).map((m) => m.m));
  assert.equal(ultimoMesComDesconto, 4 + FUNDADORES_REGRA.donos / CENARIOS.base.donosNovosMes - 1 + FUNDADORES_REGRA.meses - 1);
  for (const m of com.meses.slice(ultimoMesComDesconto)) assert.equal(m.descontoFundadores, 0);
  // Nunca maior que a diferença de taxa (12% → 8%) sobre a receita da taxa do mês.
  for (const m of com.meses) assert.ok(-m.descontoFundadores <= m.receitaTaxa * (0.12 - 0.08) / 0.12 + 1e-6);
  assert.ok(com.anos[0].receita < sem.anos[0].receita);
  assert.equal(com.anos[2].receita, sem.anos[2].receita);
});

test("p21 — roi() bate com a conta à mão", () => {
  const p = projetar("base", BASE);
  const inv = Math.abs(p.piorCaixa);
  for (const n of [12, 24, 36]) assert.ok(Math.abs(roi(p, n)! - ((p.meses[n - 1].caixa + inv) / inv - 1)) < 1e-12);
  // Caso pequeno: pior caixa −100, caixa no mês 1 = 50 → (50 + 100) / 100 − 1 = 0,5.
  const pequeno = { meses: [{ caixa: 50 }], piorCaixa: -100 } as unknown as Parameters<typeof roi>[0];
  assert.equal(roi(pequeno, 1), 0.5);
  assert.equal(roi({ ...pequeno, piorCaixa: 0 } as typeof pequeno, 1), null);
  assert.ok(INVESTIMENTO_INICIAL > 0);
});

test("p21 — receita por contrato separa as fontes e soma o total; ligar tudo sobe a receita por contrato", () => {
  const so = receitaPorContrato(BASE);
  assert.ok(Math.abs(so.receitaTaxa - 1555.2) < 1e-6);
  assert.equal(so.total, so.receitaTaxa);
  const tudo = receitaPorContrato({ ...BASE, parceiros: PARCEIROS.map((p) => p.id), extras: RECEITAS_ADICIONAIS.map((e) => e.id) });
  const soma = FONTES.reduce((s, f) => s + (tudo[f.campo] as number), 0);
  assert.ok(Math.abs(tudo.total - soma) < 1e-6);
  assert.ok(tudo.total > so.total + 100, "meta: + R$ 100 a 300 por contrato");
});

test("p21 — sensibilidade: metade da adesão atrasa (ou mantém) o payback; o dobro adianta (ou mantém)", () => {
  const tudo = { ...BASE, parceiros: PARCEIROS.map((p) => p.id), extras: RECEITAS_ADICIONAIS.map((e) => e.id) };
  const pay = (f: number) => projetar("base", { ...tudo, fatorAdesao: f }).mesPayback ?? 99;
  assert.ok(pay(0.5) >= pay(1) && pay(1) >= pay(2));
});

test("p21 — premissas: seguro-fiança acompanha a duração editável; CAF sob orçamento; selos e rodapé", () => {
  const fianca = PARCEIROS.find((p) => p.id === "seguro_fianca")!;
  const r3 = parceirosPorContrato({ ...BASE, parceiros: ["seguro_fianca"] });
  const r4 = parceirosPorContrato({ ...BASE, parceiros: ["seguro_fianca"], mesesContrato: 4 });
  assert.equal(fianca.valorUnidade, 1080);
  assert.ok(Math.abs(r4 - r3 * 4 / 3) < 0.5);
  assert.match(CUSTOS_POR_CONTRATO[0].obs!, /^CAF — sob orçamento \(Didit como referência de preço/);
  assert.equal(SELO_PARECER, "aguarda parecer jurídico");
  assert.deepEqual(RECEITAS_ADICIONAIS.filter((e) => e.aguardaParecer).map((e) => e.id), ["verificacao_inquilino", "fundadores"]);
  assert.equal(RODAPE_SOCIOS[0], "Potencial — parcerias e produtos sem contrato assinado ou sem parecer jurídico não são receita garantida");
  assert.equal(RODAPE_SOCIOS[2], "Premissas de out/2026");
});

import { fraseResumo, sensibilidadeAdesao, FATORES_ADESAO } from "./projecao.ts";

test("p21 — sensibilidadeAdesao devolve ×0,5 / ×1 / ×2 com o payback de cada um", () => {
  const tudo = { ...BASE, parceiros: PARCEIROS.map((p) => p.id), extras: RECEITAS_ADICIONAIS.map((e) => e.id) };
  const s = sensibilidadeAdesao("base", tudo);
  assert.deepEqual(s.map((x) => x.fator), [...FATORES_ADESAO]);
  assert.equal(s[1].mesPayback, projetar("base", tudo).mesPayback);
  assert.equal(s[0].mesPayback, projetar("base", { ...tudo, fatorAdesao: 0.5 }).mesPayback);
});

test("p21 — frase do topo: só taxa quando nada está ligado; compara as duas quando há receitas ligadas", () => {
  const so = projetar("base", BASE);
  const f0 = fraseResumo("Base", so, so, 0);
  assert.match(f0, /^Cenário Base, só com a taxa de serviço: a Viva precisa de até R\$ [\d.,]+ mil/);
  assert.match(f0, /retorno é de -?[\d.]+%/);
  assert.doesNotMatch(f0, /comiss|aluguel|garantia/i);
  const tudo = projetar("base", { ...BASE, parceiros: PARCEIROS.map((p) => p.id), extras: RECEITAS_ADICIONAIS.map((e) => e.id) });
  const f1 = fraseResumo("Base", so, tudo, 13);
  assert.match(f1, /com 13 receitas adicionais ligadas \(potencial\)/);
  assert.match(f1, /o retorno vai de -?[\d.]+% para -?[\d.]+%/);
  if (tudo.mesPayback !== null) assert.ok(f1.includes(`se paga no mês ${tudo.mesPayback}`));
});
