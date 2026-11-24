import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomeNaConversa } from "../../src/lib/perfil/perfil-publico.ts";

// Lab 10/11: t600 esperava "Ana I." na conversa da estadia e a tela mostrou "Ana Isabela". A estadia da spec tem
// contrato assinado pelas duas partes, e a regra (prompt 6 / E427) é: o proprietário vê "Candidato(a)" até o aceite
// e o NOME COMPLETO depois. A spec passa a esperar o nome completo (ana.nome).
test("t600: depois do aceite o dono vê o nome completo da moradora; a spec não cobra mais o nome curto", () => {
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: "Ana Isabela", aceito: true }), "Ana Isabela");
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: "Ana Isabela", aceito: false }), "Candidato(a)");
  const spec = readFileSync("tests/e2e/specs/t600-e200-conversa-da-estadia.spec.ts", "utf8");
  assert.doesNotMatch(spec, /"Ana I\."/);
  assert.match(spec, /toHaveText\(ana\.nome/);
});

// Frente 2 (auditoria do #3711): o #3711 acertou só o lado do dono. A mesma decisão E427 (45d611e23, 02/11) vale para a
// moradora: depois do aceite ela vê o NOME COMPLETO do dono, não o curto ("Dalva C."). Lab 12/11 (02a337e62, c1b1b3408,
// 4d705dee7): t600 seguia com 1 falha e 1 pulo — o teste "390 px — moradora" esperava "Dalva C.".
test("t600: depois do aceite a moradora vê o nome completo do dono; a spec não cobra mais o nome curto", () => {
  assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: "Dalva Conversa", aceito: true }), "Dalva Conversa");
  assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: "Dalva Conversa", aceito: false }), "Dalva C.");
  const spec = readFileSync("tests/e2e/specs/t600-e200-conversa-da-estadia.spec.ts", "utf8");
  assert.doesNotMatch(spec, /"Dalva C\."/);
  const moradora = spec.slice(spec.indexOf('test("390 px — moradora'), spec.indexOf('test("a primeira mensagem'));
  assert.match(moradora, /toContainText\(dono\.nome\)/);
  assert.match(moradora, /toHaveText\(dono\.nome\)/);
});
