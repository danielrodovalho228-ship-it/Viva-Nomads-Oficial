import test from "node:test";
import assert from "node:assert/strict";
import { emailMascaradoDaConta, validarVisitante } from "./identificacao-chamado.ts";

test("F24: e-mail da conta aparece mascarado, nunca inteiro", () => {
  assert.equal(emailMascaradoDaConta("daniel@gmail.com"), "da***@gmail.com");
  assert.equal(emailMascaradoDaConta("a@x.com"), "a***@x.com");
  assert.equal(emailMascaradoDaConta(""), null);
  assert.equal(emailMascaradoDaConta(null), null);
});

test("F24: visitante sem nome ou sem e-mail é recusado no servidor", () => {
  assert.equal(validarVisitante({ nome: "", email: "a@gmail.com" }).ok, false);
  assert.equal(validarVisitante({ nome: "  ", email: "a@gmail.com" }).ok, false);
  assert.equal(validarVisitante({ nome: "Ana", email: "" }).ok, false);
  assert.equal(validarVisitante({ nome: "Ana", email: "sem-arroba" }).ok, false);
});

test("F24: e-mail de domínio reservado é recusado com a mensagem clara do F2", () => {
  const r = validarVisitante({ nome: "Ana", email: "ana@example.com" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Não conseguimos usar este e-mail/);
});

test("F24: visitante válido volta normalizado", () => {
  const r = validarVisitante({ nome: "  Ana Souza ", email: " Ana@Gmail.com " });
  assert.deepEqual(r, { ok: true, nome: "Ana Souza", email: "ana@gmail.com" });
});

test("F24: e-mails legítimos passam (subdomínio, .com.br, maiúsculas, domínio do lab) e reservados são recusados", () => {
  const validos: Array<[string, string]> = [
    ["ana@mail.empresa.com.br", "ana@mail.empresa.com.br"],
    ["Ana@Empresa.COM.BR", "ana@empresa.com.br"],
    ["lab+t24@lab.vivanomads.com.br", "lab+t24@lab.vivanomads.com.br"],
    ["a.b-c@sub.dominio-novo.io", "a.b-c@sub.dominio-novo.io"],
  ];
  for (const [entrada, esperado] of validos) {
    assert.deepEqual(validarVisitante({ nome: "Ana", email: entrada }), { ok: true, nome: "Ana", email: esperado }, entrada);
  }
  for (const e of ["ana@lab.vivanomads.test", "ana@example.com", "ANA@Example.ORG", "ana@x.localhost"]) {
    assert.equal(validarVisitante({ nome: "Ana", email: e }).ok, false, e);
  }
});
