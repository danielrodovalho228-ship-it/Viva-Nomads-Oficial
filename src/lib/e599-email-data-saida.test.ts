/*
  E599 (reprova final do E562, 05/11): o e-mail da proposta dizia saída em 21/02/2027 — um dia ANTES da saída real
  (22/02/2027) gravada na candidatura, no formulário e na proposta. A contagem de dias é saída − entrada (diasDaSelecao),
  então a data de saída é entrada + dias; o e-mail usava o fim inclusivo (a última noite, entrada + dias − 1).
  Roda: node --test src/lib/e599-email-data-saida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataDeSaida } from "./contrato-periodo.ts";
import { diasDaSelecao } from "./imovel/selecao-estadia.ts";
import { linhasProposta } from "./notifications/dados-negociacao.ts";

test("E599: 43 dias a partir de 10/01/2027 saem em 22/02/2027 (a data do formulário)", () => {
  assert.equal(dataDeSaida("2027-01-10", 43), "2027-02-22");
  // ida e volta com a contagem do formulário e da candidatura
  assert.equal(diasDaSelecao({ entrada: "2027-01-10", saida: dataDeSaida("2027-01-10", 43) }), 43);
  assert.equal(dataDeSaida("2026-11-24", 30), "2026-12-24");
});

test("E599: o quadro do e-mail mostra a saída real", () => {
  const linhas = linhasProposta({
    numero: "ORC-2026-0001",
    imovel: { titulo: "Apto" },
    entrada: "2027-01-10",
    saida: dataDeSaida("2027-01-10", 43),
    meses: 2,
    dias: 43,
    valorMensal: 3260,
    contaTotal: "R$ 3.260 × 43 dias ÷ 30 = R$ 4.672,67",
  });
  const periodo = linhas.find((l) => l.rotulo === "Período")?.valor;
  assert.equal(periodo, "10/01/2027 a 22/02/2027 (43 dias)");
});

test("E599: o e-mail da proposta usa dataDeSaida, não o fim inclusivo", () => {
  const fonte = readFileSync(new URL("./data/propostas-actions.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("function dadosDoEmailDaProposta"), fonte.indexOf("import { registrarDocumento }"));
  assert.match(corpo, /saida:\s*dataDeSaida\(/);
  assert.doesNotMatch(corpo, /saida:\s*periodo\.fim/);
});
