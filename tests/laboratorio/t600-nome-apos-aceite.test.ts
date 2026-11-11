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
