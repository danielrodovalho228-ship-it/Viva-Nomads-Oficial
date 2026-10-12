/*
  F33 — etapa do contrato. Roda: node --test src/lib/contrato-etapas.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { etapaContrato, ROTULO_ETAPA, MARCA_MINUTA } from "./contrato-etapas.ts";

const AGORA = "2026-10-12T12:00:00Z";

test("sem nenhuma assinatura: Aguardando assinatura (nunca Em vigência)", () => {
  assert.equal(etapaContrato({ primeiroPagamentoConfirmado: false }), "aguardando_assinatura");
  assert.equal(ROTULO_ETAPA.aguardando_assinatura, "Aguardando assinatura");
});

test("assinatura de só UMA parte não basta", () => {
  assert.equal(etapaContrato({ assinadoProprietarioEm: AGORA, primeiroPagamentoConfirmado: true }), "aguardando_assinatura");
  assert.equal(etapaContrato({ assinadoInquilinoEm: AGORA, primeiroPagamentoConfirmado: true }), "aguardando_assinatura");
});

test("assinado pelas duas, sem 1º pagamento confirmado: Aguardando 1º pagamento", () => {
  const e = etapaContrato({ assinadoProprietarioEm: AGORA, assinadoInquilinoEm: AGORA, primeiroPagamentoConfirmado: false });
  assert.equal(e, "aguardando_pagamento");
  assert.equal(ROTULO_ETAPA[e], "Aguardando 1º pagamento");
});

test("assinado pelas duas + pagamento confirmado: Em vigência", () => {
  const e = etapaContrato({ assinadoProprietarioEm: AGORA, assinadoInquilinoEm: AGORA, primeiroPagamentoConfirmado: true });
  assert.equal(ROTULO_ETAPA[e], "Em vigência");
});

test("a marca da minuta é a do parecer pendente", () => {
  assert.equal(MARCA_MINUTA, "MINUTA DE TESTE — sem validade");
});
