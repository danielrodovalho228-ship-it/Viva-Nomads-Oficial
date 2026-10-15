/*
  Roda: node --experimental-strip-types --test src/lib/avaliacoes-resposta.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  validarResposta, validarContestacao, podeResponder, podeContestar, ehMotivoRevisao, LIMITE_RESPOSTA, MOTIVOS_REVISAO,
} from "./avaliacoes-resposta.ts";

test("resposta: vazia, longa, com contato ou ofensa são recusadas; texto normal passa", () => {
  assert.ok(validarResposta("   "));
  assert.ok(validarResposta("a".repeat(LIMITE_RESPOSTA + 1)));
  assert.ok(validarResposta("me chama no 34 99999-1234"));
  assert.ok(validarResposta("fale comigo: fulano@exemplo.com"));
  assert.ok(validarResposta("você é um babaca"));
  assert.equal(validarResposta("Obrigado pela estadia! Foi um prazer receber."), null);
});

test("pedido de revisão: só motivo objetivo + explicação de 20+ caracteres", () => {
  assert.deepEqual(Object.keys(MOTIVOS_REVISAO), ["ofensa", "dado_pessoal", "fato_falso"]);
  assert.equal(ehMotivoRevisao("discordo"), false);
  assert.ok(validarContestacao("discordo", "x".repeat(30)));
  assert.ok(validarContestacao("ofensa", "curto"));
  assert.ok(validarContestacao("ofensa", "x".repeat(LIMITE_RESPOSTA + 1)));
  assert.equal(validarContestacao("fato_falso", "O inquilino diz que o imóvel não tinha internet, mas o contrato prova que tinha."), null);
});

test("permissões: só o avaliado, só publicada, uma resposta e uma revisão pendente", () => {
  const base = { alvoId: "u1", status: "publicada", jaRespondida: false, contestacaoAberta: false };
  assert.equal(podeResponder(base, "u1"), true);
  assert.equal(podeResponder(base, "u2"), false);
  assert.equal(podeResponder({ ...base, status: "enviada" }, "u1"), false);
  assert.equal(podeResponder({ ...base, jaRespondida: true }, "u1"), false);
  assert.equal(podeContestar(base, "u1"), true);
  assert.equal(podeContestar({ ...base, contestacaoAberta: true }, "u1"), false);
  assert.equal(podeContestar({ ...base, status: "em_moderacao" }, "u1"), false);
});
