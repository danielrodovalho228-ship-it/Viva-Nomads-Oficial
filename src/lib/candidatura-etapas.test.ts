/*
  Candidatura em etapas (ordem eb4b11d8, Pacote Clareza UX5).
  Roda: node --test src/lib/candidatura-etapas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { ETAPAS_CANDIDATURA, proximaEtapa, etapaAnterior, validarApresentacao, progressoEtapa, TERMOS_CANDIDATURA } from "./candidatura-etapas.ts";

test("3 etapas na ordem: revisar, mensagem, confirmar", () => {
  assert.deepEqual(ETAPAS_CANDIDATURA.map((e) => e.chave), ["revisar", "mensagem", "confirmar"]);
});

test("avança e volta sem sair do intervalo", () => {
  assert.equal(proximaEtapa("revisar"), "mensagem");
  assert.equal(proximaEtapa("mensagem"), "confirmar");
  assert.equal(proximaEtapa("confirmar"), "confirmar");
  assert.equal(etapaAnterior("revisar"), "revisar");
  assert.equal(etapaAnterior("confirmar"), "mensagem");
});

test("progresso em % cresce por etapa", () => {
  assert.deepEqual(["revisar", "mensagem", "confirmar"].map((c) => progressoEtapa(c as never)), [33, 67, 100]);
});

test("apresentação é opcional, mas telefone/e-mail no texto são mascarados e avisados", () => {
  assert.deepEqual(validarApresentacao("   "), { ok: true, texto: "", mascarou: false });
  const r = validarApresentacao("Oi! Me liga 11 91234-5678 ou maria@exemplo.com");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.mascarou, true);
    assert.ok(!/91234|maria@/.test(r.texto));
  }
});

test("apresentação passa de 1000 caracteres: recusa com mensagem clara", () => {
  const r = validarApresentacao("a".repeat(1001));
  assert.equal(r.ok, false);
});

test("termos: texto do aceite cita termos de uso e não usa palavras proibidas", () => {
  assert.match(TERMOS_CANDIDATURA, /termos de uso/i);
  assert.ok(!/temporada|vistoria|comiss|corretagem|intermedia/i.test(TERMOS_CANDIDATURA));
});
