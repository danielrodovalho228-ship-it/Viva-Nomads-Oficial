/** Testes dos utilitários de nome de exibição (fonte única). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { primeiroNome, usuarioDoEmail, nomeCompletoLimpo, displayName } from "./display-name.ts";

test("primeiroNome: devolve o primeiro nome; '@' vira vazio", () => {
  assert.equal(primeiroNome("Daniel Rodovalho"), "Daniel");
  assert.equal(primeiroNome("dtrodovalho40@gmail.com"), "");
  assert.equal(primeiroNome(""), "");
  assert.equal(primeiroNome(null), "");
});

test("usuarioDoEmail: parte antes do @ (sem expor o e-mail inteiro)", () => {
  assert.equal(usuarioDoEmail("dtrodovalho40@gmail.com"), "dtrodovalho40");
  assert.equal(usuarioDoEmail("  ana.silva@viva.com "), "ana.silva");
  assert.equal(usuarioDoEmail("sem-arroba"), "");
  assert.equal(usuarioDoEmail(""), "");
  assert.equal(usuarioDoEmail(null), "");
});

test("nomeCompletoLimpo: some com o e-mail poluído no campo Nome completo", () => {
  assert.equal(nomeCompletoLimpo("Daniel Rodovalho"), "Daniel Rodovalho");
  assert.equal(nomeCompletoLimpo("dtrodovalho40@gmail.com"), "");
  assert.equal(nomeCompletoLimpo(null), "");
});

test("displayName: primeiro nome ou null (nunca e-mail)", () => {
  assert.equal(displayName({ fullName: "Ana Paula" }), "Ana");
  assert.equal(displayName({ fullName: "x@y.com" }), null);
  assert.equal(displayName(null), null);
});
