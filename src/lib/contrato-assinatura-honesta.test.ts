/*
  F36/F39/F40 — o fechamento nunca diz "enviado para assinatura" sem enviar, o PDF
  não fica morto e todo contrato leva a marca de minuta.
  Roda: node --test src/lib/contrato-assinatura-honesta.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { MARCA_MINUTA, MSG_ASSINATURA_INATIVA } from "./contrato-etapas.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const fluxo = ler("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
const gerar = fluxo.slice(fluxo.indexOf("async function generateContract"), fluxo.indexOf("const canAdvance"));

test("mensagens fixas da ordem", () => {
  assert.equal(MSG_ASSINATURA_INATIVA, "Assinatura digital ainda não ativa — contrato em modo de teste.");
  assert.equal(MARCA_MINUTA, "MINUTA DE TESTE — sem validade");
});

test("F40 + p24: conta REAL sem assinatura (inativa) não marca como gerado nem cobra; conta de TESTE segue o fluxo", () => {
  // A rota diz o modo; a tela decide pela regra única (passoDaRespostaContrato: 503/"inativa" → inativa).
  assert.match(gerar, /passoDaRespostaContrato\(res\.status, data\)/);
  assert.match(gerar, /passo === "inativa"/);
  // o 'return' da assinatura inativa vem ANTES da cobrança e do registro do contrato
  assert.ok(gerar.indexOf("MSG_ASSINATURA_INATIVA") < gerar.indexOf('"/api/comissao"'));
  assert.ok(gerar.indexOf("MSG_ASSINATURA_INATIVA") < gerar.indexOf("registrarContrato("));
  // p24: a resposta simulada da conta de TESTE não é mais tratada como "inativa" (era o beco sem saída).
  assert.doesNotMatch(gerar, /res\.ok && data\.demo/);
});

test("F40: o catch não avança mais o assistente (antes setGenerated(true) mesmo com erro)", () => {
  const catchBloco = gerar.slice(gerar.lastIndexOf("} catch"));
  assert.doesNotMatch(catchBloco, /setGenerated\(true\)/);
  assert.match(catchBloco, /setErroContrato\(/);
});

test("F36: o contrato só conta como gerado se o registro no banco deu certo", () => {
  assert.match(gerar, /if \(!reg\.ok\)/);
  assert.ok(gerar.indexOf("if (!reg.ok)") < gerar.lastIndexOf("setGenerated(true)"));
});

test("F39: o botão de PDF do contrato fica desabilitado com aviso", () => {
  assert.match(fluxo, /pdfDisponivel=\{false\}/);
  const share = ler("../components/document-share.tsx");
  assert.match(share, /disabled=\{!pdfDisponivel\}/);
  assert.match(share, /aviso-pdf/);
});

test("minuta: marca no topo da etapa do contrato e no nome do documento enviado", () => {
  assert.match(fluxo, /data-testid="marca-minuta"/);
  assert.match(ler("./integrations/zapsign.ts"), /\$\{MARCA_MINUTA\}/);
});
