import test from "node:test";
import assert from "node:assert/strict";
import { dominioDoEmail, dominioReservado } from "./email-dominio.ts";

test("F2: domínios reservados são barrados", () => {
  for (const e of ["a@example.com", "a@EXAMPLE.net", "a@x.example.org", "a@qa.test", "a@foo.invalid", "a@x.localhost", "a@meu.example"]) {
    const d = dominioDoEmail(e);
    assert.ok(d, e);
    assert.equal(dominioReservado(d!), true, e);
  }
});

test("F2: domínios reais passam e e-mail malformado não tem domínio", () => {
  for (const e of ["a@gmail.com", "b@empresa.com.br", "c@exemplo.com.br"]) {
    assert.equal(dominioReservado(dominioDoEmail(e)!), false, e);
  }
  for (const e of ["semarroba", "@x.com", "a@", "a@semponto", "a@-x.com"]) assert.equal(dominioDoEmail(e), null, e);
});
