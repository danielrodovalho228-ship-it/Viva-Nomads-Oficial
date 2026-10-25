import test from "node:test";
import assert from "node:assert/strict";
import { emailMascaradoDaConta, normalizarTelefone, telefoneMascarado, validarVisitante } from "./identificacao-chamado.ts";

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

test("F24: telefone do visitante é opcional, só dígitos e guardado normalizado", () => {
  assert.equal(normalizarTelefone(undefined), "");
  assert.equal(normalizarTelefone("   "), "");
  assert.equal(normalizarTelefone("(34) 99999-1234"), "34999991234");
  assert.equal(normalizarTelefone("+55 34 99999-1234"), "5534999991234");
  assert.equal(normalizarTelefone("3432221234"), "3432221234");
});

test("F24: telefone inválido (curto, longo, letras) é recusado; vazio passa", () => {
  const base = { nome: "Ana", email: "ana@gmail.com" };
  assert.deepEqual(validarVisitante({ ...base, telefone: "" }), { ok: true, nome: "Ana", email: "ana@gmail.com" });
  assert.deepEqual(validarVisitante({ ...base, telefone: "(34) 99999-1234" }), { ok: true, nome: "Ana", email: "ana@gmail.com", telefone: "34999991234" });
  for (const t of ["12345", "abc", "123456789012345678", "34 9999"]) {
    const r = validarVisitante({ ...base, telefone: t });
    assert.equal(r.ok, false, t);
  }
});

test("F24: a equipe vê o telefone mascarado, nunca inteiro", () => {
  assert.equal(telefoneMascarado("34999991234"), "(34) •••••-1234");
  assert.equal(telefoneMascarado("5534999991234"), "(34) •••••-1234");
  assert.equal(telefoneMascarado(null), null);
  assert.equal(telefoneMascarado("123"), null);
});
