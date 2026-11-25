/*
  E1061 — a caução tem UMA conta: a do contrato. Lei do produto (Daniel, 20/11/2026): a caução é metade do aluguel da
  estadia toda, no máximo 3 vezes o valor mensal. Na prova ao vivo de 20/11 o anúncio dizia R$ 1.250 e a proposta
  R$ 1.292; por baixo havia três contas (o cadastro, a página do imóvel e a proposta/contrato). A proposta e a
  candidatura passam a ler a função do contrato (`caucaoDaEstadiaEmDias`), com os dias da própria estadia.
  Roda: node --test src/lib/e1061-caucao-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caucaoDaEstadiaEmDias, resumoContratoEmDias } from "./contrato-blocos.ts";
import { caucaoDaProposta, rotuloCaucaoDaProposta } from "./propostas/caucao-da-proposta.ts";
import { linhasDeTaxas, resumoSolicitacao } from "./reserva-imovel.ts";
import { formatBRL } from "./utils.ts";

const DIAS = [30, 31, 43, 60, 61, 90, 91, 120, 150, 180];
const MENSAIS = [2500, 2800, 3000, 4333.33];

test("E1061: a caução da estadia é a soma das cauções dos blocos do contrato, qualquer que seja a taxa", () => {
  for (const d of DIAS) for (const m of MENSAIS) {
    const c = caucaoDaEstadiaEmDias(d, m);
    for (const taxa of [0, 0.06, 0.12]) assert.equal(c, resumoContratoEmDias(d, m, taxa).caucaoTotal, `${d} dias a ${m}, taxa ${taxa}`);
    assert.ok(c <= 3 * m + 0.01, `teto de 3 vezes o mensal: ${d} dias a ${m}`);
  }
  assert.equal(caucaoDaEstadiaEmDias(0, 3000), 0);
  assert.equal(caucaoDaEstadiaEmDias(60, 0), 0);
});

test("E1061: os exemplos da lei (ORDEM-DUET-302), a R$ 2.500 por mês", () => {
  // 30 dias R$ 1.250 · 31 dias R$ 1.292 · 60 dias R$ 2.500 · 90 dias R$ 3.750 · 180 dias R$ 7.500 (o teto: 3 aluguéis).
  for (const [dias, caucao] of [[30, 1250], [31, 1292], [60, 2500], [90, 3750], [180, 7500]] as const) {
    assert.equal(caucaoDaEstadiaEmDias(dias, 2500), caucao, `${dias} dias`);
    assert.equal(caucaoDaProposta({ meses: Math.ceil(dias / 30), dias }, 2500)?.valor, caucao, `proposta de ${dias} dias`);
  }
});

test("E1061: o caso da prova ao vivo — 31 dias a R$ 2.500: a proposta diz o número do contrato", () => {
  const c = caucaoDaProposta({ meses: 2, dias: 31 }, 2500);
  assert.ok(c);
  assert.equal(c.valor, resumoContratoEmDias(31, 2500, 0.1).caucaoTotal);
  assert.equal(c.dias, 31);
  assert.equal(rotuloCaucaoDaProposta(c), "Caução (50% do aluguel da estadia, 31 dias)");
});

test("E1061: a proposta mostra a caução da estadia TODA (todos os blocos), não só a do 1º bloco", () => {
  for (const d of DIAS) for (const m of MENSAIS) {
    const c = caucaoDaProposta({ meses: Math.ceil(d / 30), dias: d }, m);
    assert.ok(c, `${d} dias a ${m}`);
    assert.equal(c.valor, caucaoDaEstadiaEmDias(d, m), `${d} dias a ${m}`);
    assert.equal(c.dias, d);
  }
  // 120 dias a R$ 3.000: 2 blocos de 60 dias; o contrato soma R$ 6.000 e a proposta mostrava só os R$ 3.000 do 1º.
  const longa = caucaoDaProposta({ meses: 4, dias: 120 }, 3000)!;
  assert.equal(longa.valor, 6000);
  assert.equal(longa.blocos, 2);
  assert.equal(longa.primeiroBloco, 3000);
});

const base = { monthlyPrice: 2500, hoje: "2026-11-20", janela: { minDias: 30, maxDias: 180 } };
const linhaCaucao = (e: Parameters<typeof resumoSolicitacao>[0]) => resumoSolicitacao(e).linhas.find((l) => l.rotulo === "Caução")!.valor;

test("E1061: a candidatura com as datas escolhidas diz a caução do contrato para aqueles dias", () => {
  // 01/12 → 01/01: 31 dias.
  const v = linhaCaucao({ ...base, inicioDesejado: "2026-12-01", fimDesejado: "2027-01-01" });
  assert.match(v, /nesta estadia \(31 dias\)/);
  assert.ok(v.startsWith(formatBRL(caucaoDaEstadiaEmDias(31, 2500))), v);
  assert.match(v, /paga direto ao proprietário e devolvida no fim/);
});

test("E1061: a candidatura sem datas continua a dizer a caução do 1º bloco da estadia mínima do anúncio", () => {
  const v = linhaCaucao(base);
  assert.match(v, /no 1º bloco, paga direto ao proprietário e devolvida no fim/);
  assert.ok(v.startsWith(formatBRL(1250)), v);
});

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E1061: na página do imóvel, com as datas escolhidas, a caução é a do contrato para aqueles dias", () => {
  const anuncio = { monthlyPrice: 2500, minPeriodDays: 30 };
  const caucao = (dias?: number | null) => linhasDeTaxas(anuncio, dias).find((l) => l.chave === "caucao")!;
  // Sem datas: o valor de referência do anúncio (o 1º bloco da estadia mínima) não muda.
  assert.equal(caucao().rotulo, "Caução do 1º bloco (1 mês)");
  assert.equal(caucao().valor, formatBRL(1250));
  assert.deepEqual(caucao(null), caucao());
  // Com 31 dias escolhidos (o caso da prova ao vivo): o mesmo R$ 1.292 da proposta e do contrato.
  assert.equal(caucao(31).rotulo, "Caução nesta estadia (31 dias)");
  assert.equal(caucao(31).valor, formatBRL(caucaoDaEstadiaEmDias(31, 2500)));
  assert.equal(caucao(31).valor, formatBRL(caucaoDaProposta({ meses: 2, dias: 31 }, 2500)!.valor));
  assert.equal(caucao(90).valor, formatBRL(3750));
  assert.equal(caucao(31).nota, caucao().nota);
  // O cartão de preço passa os dias escolhidos (já nulos quando a estadia fica abaixo do mínimo).
  assert.match(ler("../components/property/price-card.tsx"), /linhasDeTaxas\(property, dias\)/);
});

test("E1061: a proposta, nas duas telas, escreve o rótulo da mesma função e não fala mais em \"1º bloco\" no rótulo", () => {
  for (const tela of ["../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx", "../app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx"]) {
    const t = ler(tela);
    assert.match(t, /rotuloCaucaoDaProposta\(caucao\)/, tela);
    assert.doesNotMatch(t, /Caução \(50% do 1º bloco/, tela);
  }
  assert.match(ler("./propostas/caucao-da-proposta.ts"), /resumoContratoEmDias\(/);
});

test("E1061: o fechamento mostra esse mesmo total — a soma dos blocos do contrato em dias", () => {
  const fechamento = ler("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(fechamento, /resumoContratoEmDias\(DIAS_ACORDO, PROPERTY\.monthlyRent, COMMISSION_RATE, TAMANHO_BLOCO\)/);
  assert.match(fechamento, /const CAUCAO_50 = resumo\.caucaoTotal;/);
});
