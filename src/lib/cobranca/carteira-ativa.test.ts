/*
  E565: a faixa da tabela conta só imóveis ATIVOS DE VERDADE — publicado, documento aprovado (o vigente) e calendário
  confirmado nos últimos 30 dias. Rascunho ou anúncio parado não infla a carteira para derrubar a taxa.
  O congelamento (menor faixa entre envio e aceite) não muda: só o que CONTA para a faixa.
  Roda: node --test src/lib/cobranca/carteira-ativa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIAS_CALENDARIO_EM_DIA, ativosDeVerdade, contaParaFaixa } from "./carteira-ativa.ts";
import { faixaPorImoveisAtivos, taxaNaAssinatura } from "./regra.ts";
import { taxaEfetivaDaProposta } from "../propostas/regras.ts";

const AGORA = new Date("2026-11-04T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const OK = { status: "active", documento: "approved", calendarioConfirmadoEm: dias(1) } as const;

test("conta: publicado + documento aprovado + calendário confirmado nos últimos 30 dias", () => {
  assert.equal(DIAS_CALENDARIO_EM_DIA, 30);
  assert.equal(contaParaFaixa(OK, AGORA), true);
  assert.equal(contaParaFaixa({ ...OK, calendarioConfirmadoEm: dias(30) }, AGORA), true);
});

test("não conta: rascunho, pausado, sem documento aprovado ou calendário parado", () => {
  assert.equal(contaParaFaixa({ ...OK, status: "draft" }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, status: "paused" }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, documento: "pending" }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, documento: "rejected" }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, documento: "none" }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, calendarioConfirmadoEm: dias(31) }, AGORA), false);
  assert.equal(contaParaFaixa({ ...OK, calendarioConfirmadoEm: null }, AGORA), false);
});

test("a carteira inflada por anúncios parados não derruba a taxa", () => {
  const carteira = [OK, OK, { ...OK, calendarioConfirmadoEm: null }, { ...OK, status: "draft" }, { ...OK, documento: "pending" }];
  assert.equal(ativosDeVerdade(carteira, AGORA), 2);
  assert.equal(faixaPorImoveisAtivos(ativosDeVerdade(carteira, AGORA)).taxa, 0.12); // 2 de verdade → 12%, não 10% (5 ativos)
  assert.equal(ativosDeVerdade([OK, OK, OK], AGORA), 3);
  assert.equal(faixaPorImoveisAtivos(3).taxa, 0.1);
});

test("o congelamento não muda: menor entre a taxa do envio e a da faixa de hoje", () => {
  const hoje = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: ativosDeVerdade([OK], AGORA), assinadoEm: AGORA }).taxa;
  assert.equal(taxaEfetivaDaProposta(0.1, hoje), 0.1);
  assert.equal(taxaEfetivaDaProposta(0.12, 0.1), 0.1);
});

test("o servidor conta os ativos de verdade (documento vigente e calendário), nunca só o status", () => {
  const s = readFileSync("src/lib/cobranca/taxa-servidor.ts", "utf8");
  assert.match(s, /select\("id, status, disponibilidade_confirmada_em"\)/);
  assert.match(s, /statusPorImovel\(/);
  assert.match(s, /const imoveisAtivos = await contarAtivosDeVerdade\(admin, /);
  assert.match(s, /return ativosDeVerdade\(/);
  assert.doesNotMatch(s, /select\("id", \{ count: "exact", head: true \}\)\.eq\("owner_id", ownerId\)\.eq\("status", "active"\)/);
});
