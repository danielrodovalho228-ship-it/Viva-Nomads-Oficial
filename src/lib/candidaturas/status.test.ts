/** Testes do vocabulário de status da candidatura (tela do inquilino). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { situacaoCandidatura, ROTULOS_CANDIDATURA } from "./status.ts";

test("aceite → 'Aceita 🎉' (sucesso)", () => {
  const r = situacaoCandidatura("accepted");
  assert.equal(r.chave, "aceita");
  assert.equal(r.label, "Aceita 🎉");
  assert.equal(r.tom, "sucesso");
});

test("recusa → 'Não seguiu adiante' — NUNCA 'recusada/rejeitada' na tela do inquilino", () => {
  const r = situacaoCandidatura("rejected");
  assert.equal(r.chave, "nao_seguiu");
  assert.equal(r.label, "Não seguiu adiante");
  assert.doesNotMatch(r.label.toLowerCase(), /recus|rejeit/);
});

test("em aberto: 'Enviada' sem engajamento do dono, 'Em análise' com engajamento", () => {
  assert.equal(situacaoCandidatura("new", false).label, "Enviada");
  assert.equal(situacaoCandidatura("new", true).label, "Em análise");
});

test("status desconhecido cai no estado em aberto (nunca quebra)", () => {
  assert.equal(situacaoCandidatura("qualquer-coisa").chave, "enviada");
});

test("nenhum rótulo do inquilino usa jargão de recusa", () => {
  for (const r of Object.values(ROTULOS_CANDIDATURA)) {
    assert.doesNotMatch(r.label.toLowerCase(), /recus|rejeit/, `jargão em: ${r.label}`);
  }
});
