import test from "node:test";
import assert from "node:assert/strict";
import { subleaseParaGravar, autorizacaoOk } from "./operacao.ts";

test("imóvel próprio nunca grava sublocação autorizada, mesmo que o cliente mande true", () => {
  assert.equal(subleaseParaGravar("own", true), false);
  assert.equal(subleaseParaGravar(undefined, true), false);
  assert.equal(subleaseParaGravar("valor-invalido", true), false);
});

test("sublocação e administração gravam a declaração do dono", () => {
  assert.equal(subleaseParaGravar("subleased", true), true);
  assert.equal(subleaseParaGravar("managed", true), true);
  assert.equal(subleaseParaGravar("subleased", undefined), false);
  assert.equal(subleaseParaGravar("managed", false), false);
});

test("imóvel próprio segue liberado para publicar sem a autorização", () => {
  assert.ok(autorizacaoOk({ ownership_type: "own", sublease_authorized: false }));
});
