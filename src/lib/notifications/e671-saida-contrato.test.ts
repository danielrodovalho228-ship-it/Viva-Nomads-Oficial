/*
  E671 (07/11, retomada do E652): os e-mails do contrato diziam "Período: 10/01/2027 a 11/03/2027 (2 meses)"; a página do
  contrato, a estadia e os calendários dizem saída em 10/03/2027. 11/03 = entrada + 60 dias; 10/03 = o fim gravado nos
  blocos (a conta de 2 meses = 60 dias, fim inclusivo). Os e-mails do contrato passam a dizer a MESMA data da página do
  contrato (o fim gravado), a que também comanda o prazo da conferência de saída. A proposta e a candidatura seguem
  com entrada + dias (E599).
  Roda: node --test src/lib/notifications/e671-saida-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encadearDatas, periodoDosBlocos } from "../contrato-blocos.ts";
import { textoSaida } from "../estadia/estadia.ts";
import { linhasContrato } from "./dados-negociacao.ts";

const IM = { titulo: "Apto" };

test("E671: contrato de 2 meses a partir de 10/01/2027 — o e-mail e a página dizem saída 10/03/2027", () => {
  const blocos = encadearDatas("2027-01-10", [{ meses: 2 } as never]);
  const { inicio, fim } = periodoDosBlocos(blocos);
  assert.equal(fim, "2027-03-10");
  const l = linhasContrato({ imovel: IM, inicio: inicio!, fim: fim!, meses: 2, valorMensal: 3000 });
  assert.equal(l.find((x) => x.rotulo === "Período")?.valor, "10/01/2027 a 10/03/2027 (2 meses)");
  assert.match(textoSaida({ inicio, fim, checkinAfter: null, checkoutBefore: null }), /10\/03\/2027/);
});

test("E671: o e-mail do contrato não soma um dia ao fim gravado", () => {
  const fonte = readFileSync(new URL("./dados-negociacao.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("export function linhasContrato"));
  assert.doesNotMatch(corpo.slice(0, corpo.indexOf("export type Desfecho")), /saidaDepoisDaUltimaNoite\(/);
});
