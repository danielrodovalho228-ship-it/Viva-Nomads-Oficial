/*
  E583 — a conta da candidatura não fechava com a fórmula aprovada (estadia em dias: total por mês × dias ÷ 30, mais os
  pagamentos únicos; E562). Candidatura do Lucas no VN-4A693A (lead a65945b6, 15/01 → 19/02/2027 = 35 dias; aluguel
  R$ 2.800 + contas R$ 250 = R$ 3.050/mês; preparação R$ 300). A tela do "Pedir para morar" (resumoSolicitacao +
  estadiaDoImovelEmDias) dá R$ 3.858,33 = 3.050 × 35 ÷ 30 + 300. O E-MAIL da candidatura (dono "nova", morador
  "enviada" e "aceita") fazia a conta por MESES arredondados para cima: "R$ 6.100 em 2 meses". Uma conta só: o e-mail
  passa a usar a MESMA função da tela (estadiaDoImovelEmDias), com o rótulo e a conta aberta; sem o anúncio público,
  o proporcional (total por mês × dias ÷ 30), nunca meses arredondados. O morador não paga taxa à Viva: nenhuma linha
  de taxa entra no quadro.
  Roda: node --test src/lib/notifications/e583-total-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasCandidatura } from "./dados-candidatura.ts";
import { estadiaDoImovelEmDias, formatBRLExato, periodoPorExtenso } from "../precos.ts";

const imovel = { titulo: "TESTE QA - Casa mobiliada 2 quartos no Centro", bairro: "Centro", cidade: "Uberlândia" };
// O anúncio 4a693a63 (produção, leitura de 05/11): aluguel 2.800, contas fixas 250, preparação 300, sem limpeza.
const anuncio = { monthlyPrice: 2800, condoFee: 0, utilitiesMode: "fixed", utilitiesEstimate: 250, prepFee: 300 } as unknown as Parameters<typeof estadiaDoImovelEmDias>[0];

test("a tela e o e-mail dizem o mesmo total: R$ 3.858,33 em 35 dias (nunca R$ 6.100 em 2 meses)", () => {
  const tela = estadiaDoImovelEmDias(anuncio, 35)!;
  assert.equal(tela.total, 3858.33);
  const l = linhasCandidatura({ imovel, interessado: "Lucas", entrada: "2027-01-15", saida: "2027-02-19", valorMensal: 2800, totalMensal: 3050, estadiaDias: tela });
  const total = l.find((x) => x.rotulo.startsWith("Total da estadia"))!;
  assert.equal(total.rotulo, tela.rotulo);
  assert.equal(total.valor, `${formatBRLExato(3858.33)} (${periodoPorExtenso(35)})`);
  assert.equal(l.find((x) => x.rotulo === "Conta do total")?.valor, `${tela.conta} = ${formatBRLExato(3858.33)}`);
  assert.ok(!l.some((x) => /taxa/i.test(x.rotulo)), "o morador não paga taxa à Viva");
});

test("sem o anúncio público: o proporcional do mês (× dias ÷ 30), não meses arredondados", () => {
  const l = linhasCandidatura({ imovel, interessado: "Lucas", entrada: "2027-01-15", saida: "2027-02-19", valorMensal: 2800, totalMensal: 3050 });
  assert.equal(l.find((x) => x.rotulo.startsWith("Total da estadia"))?.valor, `${formatBRLExato(3558.33)} (${periodoPorExtenso(35)})`);
});

test("o corpo do e-mail calcula a estadia pela função da tela", () => {
  const s = readFileSync(new URL("../data/candidatura-email.ts", import.meta.url), "utf8");
  assert.match(s, /estadiaDias: publico && p \? estadiaDoImovelEmDias\(publico, p\.dias\) : null,/);
});
