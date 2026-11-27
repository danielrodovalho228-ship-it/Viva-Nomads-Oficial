/*
  E562 (telas) — o caminho INTEIRO em dias, com o mesmo cálculo: anúncio (barra lateral e passos 1 e 3 do "Pedir para
  morar") → candidatura (entrada, saída e dias) → montagem da proposta → proposta enviada.
  Por que o PR #2512 não mudou as telas: ele trocou a regra só no servidor (calcularTotais, precoDaProposta, contrato);
  as telas do anúncio arredondavam a seleção para meses (mesesDaSelecao → estadiaDoImovel) e a montagem tinha o
  controle "Número de meses" (meses × 30). Este teste prende as telas à regra em dias.
  Caso do QA: VN-4A693A (aluguel R$ 2.800 + contas R$ 250 = R$ 3.050/mês, preparação R$ 300), 01/12/2026 → 13/01/2027.
  Roda: node --test src/lib/e562-telas-em-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadiaDoImovelEmDias, periodoPorExtenso, precoDaProposta, rotuloTotalDaEstadia, termosDaEstadiaDoImovel } from "./precos.ts";
import { calcularTotais, taxaServicoProposta, type TermosProposta } from "./propostas/regras.ts";
import { periodoDaCandidatura } from "./notifications/dados-candidatura.ts";
import { diasDaSelecao } from "./imovel/selecao-estadia.ts";
import { resumoSolicitacao } from "./reserva-imovel.ts";
import { blocosEmDias } from "./estadia-em-dias.ts";

const ler = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const VN_4A693A = {
  monthlyPrice: 2800,
  condoFee: 0,
  utilitiesMode: "fixed" as const,
  utilitiesEstimate: 250,
  prepFee: 300,
  checkoutCleaningEnabled: false,
  checkoutCleaningFee: 0,
};
const SELECAO = { entrada: "2026-12-01", saida: "2027-01-13" };

test("período por extenso e rótulo: 43 dias = 1 mês + 13 dias", () => {
  assert.equal(periodoPorExtenso(43), "1 mês + 13 dias");
  assert.equal(periodoPorExtenso(60), "2 meses");
  assert.equal(periodoPorExtenso(31), "1 mês + 1 dia");
  assert.equal(rotuloTotalDaEstadia(43), "Total da estadia (43 dias)");
});

test("anúncio: 43 dias no VN-4A693A = R$ 4.371,67 + preparação R$ 300 = R$ 4.671,67", () => {
  const e = estadiaDoImovelEmDias(VN_4A693A, 43)!;
  assert.equal(e.total, 4671.67);
  assert.equal(e.rotulo, "Total da estadia (43 dias)");
  assert.equal(e.periodo, "1 mês + 13 dias");
  assert.match(e.conta, /R\$\s3\.050 × 43 dias ÷ 30 \(1 mês \+ 13 dias\)/);
  assert.match(e.conta, /limpeza de preparação R\$\s300/);
});

test("passos 1 e 3 do Pedir para morar: Total da estadia (43 dias), sem meses", () => {
  const dias = diasDaSelecao(SELECAO)!;
  assert.equal(dias, 43);
  const r = resumoSolicitacao({ monthlyPrice: 2800, inicioDesejado: SELECAO.entrada, fimDesejado: SELECAO.saida, hoje: "2026-11-05", totalMensal: 3050, estadiaDias: estadiaDoImovelEmDias(VN_4A693A, dias) });
  const total = r.linhas.find((l) => l.rotulo === "Total da estadia (43 dias)");
  assert.ok(total, "linha Total da estadia (43 dias)");
  assert.match(total!.valor, /4\.671,67/);
  assert.match(total!.valor, /1 mês \+ 13 dias/);
  assert.equal(r.linhas.some((l) => /em \d+ meses?/.test(l.valor)), false);
  const conta = r.linhas.find((l) => l.rotulo === "Conta do total");
  assert.match(conta!.valor, /× 43 dias ÷ 30 .* = R\$\s4\.671,67/);
});

test("candidatura de 43 dias → proposta: o mesmo total, a taxa e a caução pelos dias", () => {
  const dias = periodoDaCandidatura(SELECAO.entrada, SELECAO.saida)!.dias;
  assert.equal(dias, 43);
  const t = termosDaEstadiaDoImovel(VN_4A693A);
  const termos: TermosProposta = {
    valorBase: VN_4A693A.monthlyPrice,
    descontoPct: 0,
    descontoValor: 0,
    motivoDesconto: null,
    descontoEstadiaPct: 0,
    meses: 2,
    dias,
    dataEntrada: SELECAO.entrada,
    condominio: t.condominio,
    consumo: t.consumo,
    limpezasMes: t.limpezasMes,
    valorLimpeza: t.valorLimpeza,
    taxaPet: 0,
    limpezaUnica: t.limpezaUnica,
  };
  const tot = calcularTotais(termos);
  assert.equal(tot.totalContrato, 4671.67);
  assert.equal(tot.totalContrato, estadiaDoImovelEmDias(VN_4A693A, dias)!.total);
  const preco = precoDaProposta({ ...termos, valorMensal: tot.valorMensal });
  assert.equal(preco.totalContrato, 4671.67);
  assert.match(preco.conta ?? "", /43 dias/);
  // Taxa de serviço sobre o aluguel proporcional (2.800 × 43 ÷ 30 = 4.013,33), não sobre 2 meses cheios.
  assert.equal(taxaServicoProposta(termos, 0.1), 401.33);
  // Caução: 50% do bloco proporcional (um bloco de 43 dias).
  const [b] = blocosEmDias(dias, 2800);
  assert.equal(b.dias, 43);
  assert.equal(b.caucao, Math.round((2800 * 43) / 30 / 2));
});

test("as telas usam os dias, não os meses arredondados", () => {
  const detalhe = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(detalhe, /estadiaDoImovelEmDias\(property, diasSelecao\)/);
  assert.doesNotMatch(detalhe, /estadia: mesesSelecao \? estadiaDoImovel/);
  const card = ler("components/property/price-card.tsx");
  assert.match(card, /estadiaDoImovelEmDias\(property, dias\)/);
  const montagem = ler("app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx");
  assert.doesNotMatch(montagem, /Número de meses/);
  assert.doesNotMatch(montagem, /data-testid="proposta-meses"/);
  assert.match(montagem, /rotuloTotalDaEstadia\(/);
  // A proposta parte dos MESMOS termos do anúncio.
  assert.match(ler("lib/data/propostas-actions.ts"), /termosDaEstadiaDoImovel\(/);
});
