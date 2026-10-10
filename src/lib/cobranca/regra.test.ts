import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEXTO_REGRA_UNICA,
  cobrancaParaAceite,
  fixacaoAdminValida,
  pctTexto,
  taxaDeConfig,
  taxaNaAssinatura,
  valorTaxa,
} from "./regra.ts";

const em = new Date("2026-10-10T12:00:00Z");

test("4.320 × 12% = 518,40 no contrato novo E na renovação", () => {
  assert.equal(cobrancaParaAceite({ tipo: "novo", aluguelMensal: 4320, assinadoEm: em }).valor, 518.4);
  assert.equal(cobrancaParaAceite({ tipo: "renovacao", aluguelMensal: 4320, assinadoEm: em }).valor, 518.4);
});

test("a taxa não depende do nº de imóveis (dono com 30 imóveis também paga 12%)", () => {
  // a assinatura da função nem aceita imóveis: regra igual para todos, por construção
  const t = taxaNaAssinatura({ tipo: "novo", assinadoEm: em });
  assert.equal(t.taxa, 0.12);
  assert.equal(t.origem, "regra_unica");
  assert.equal(valorTaxa(4320, t.taxa), 518.4);
});

test("config (taxa_comissao / taxa_renovacao em %) manda; inválida cai no padrão 12%", () => {
  assert.equal(taxaDeConfig("12", 0.12), 0.12);
  assert.equal(taxaDeConfig("15", 0.12), 0.15);
  for (const ruim of [null, undefined, "", "abc", "-1", "101"]) assert.equal(taxaDeConfig(ruim, 0.12), 0.12);
  const cfg = { taxaComissao: 0.12, taxaRenovacao: 0.1 };
  assert.equal(taxaNaAssinatura({ tipo: "renovacao", assinadoEm: em, config: cfg }).taxa, 0.1);
  assert.equal(taxaNaAssinatura({ tipo: "novo", assinadoEm: em, config: cfg }).taxa, 0.12);
});

test("valorTaxa: entradas inválidas = 0", () => {
  assert.equal(valorTaxa(-1, 0.12), 0);
  assert.equal(valorTaxa(0, 0.12), 0);
  assert.equal(valorTaxa(4320, Number.NaN), 0);
  assert.equal(valorTaxa(Number.NaN, 0.12), 0);
});

test("override do admin exige motivo e validade; vencido, sem motivo ou fora de 0..1 é ignorado", () => {
  const ate = new Date("2026-12-31T00:00:00Z");
  const ok = taxaNaAssinatura({ tipo: "novo", assinadoEm: em, fixadaPeloAdmin: { taxa: 0.05, motivo: "negociação", validoAte: ate } });
  assert.deepEqual([ok.taxa, ok.origem], [0.05, "admin"]);
  const ruins = [
    { taxa: 0.05, motivo: "negociação", validoAte: new Date("2026-10-01T00:00:00Z") },
    { taxa: 0.05, motivo: "  ", validoAte: ate },
    { taxa: 0.05, motivo: "x", validoAte: ate },
    { taxa: 1.5, motivo: "negociação", validoAte: ate },
  ];
  for (const f of ruins) {
    assert.equal(fixacaoAdminValida(f, em), false);
    assert.equal(taxaNaAssinatura({ tipo: "novo", assinadoEm: em, fixadaPeloAdmin: f }).taxa, 0.12);
  }
});

test("texto oficial: 12%, sem mensalidade, sem plano nem faixa", () => {
  assert.match(TEXTO_REGRA_UNICA, /Anunciar é grátis\. Você só paga quando alugar: 12% do primeiro aluguel de cada contrato e de cada renovação\./);
  assert.match(TEXTO_REGRA_UNICA, /1 ou 100 imóveis\. Sem mensalidade\. O inquilino não paga taxa da plataforma\.$/);
  assert.doesNotMatch(TEXTO_REGRA_UNICA, /plano|faixa|Essencial|Gestor/i);
  assert.equal(pctTexto(0.12), "12%");
});
