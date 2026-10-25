import test from "node:test";
import assert from "node:assert/strict";
import { subleaseParaGravar, autorizacaoOk, tipoDocParaGravar, tipoDocValido } from "./operacao.ts";

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

const DONO = "11111111-1111-1111-1111-111111111111";
const gestao = { owner_id: DONO, ownership_type: "managed", sublease_authorized: true, sublease_doc_url: `${DONO}/doc.pdf` };

test("administrado sem tipo de documento não está em ordem (ordem ab50d8af)", () => {
  assert.equal(autorizacaoOk({ ...gestao, sublease_doc_tipo: null }), false);
  assert.equal(autorizacaoOk({ ...gestao }), false);
  assert.equal(autorizacaoOk({ ...gestao, sublease_doc_tipo: "autorizacao" }), false);
});

test("administrado com contrato de gestão ou procuração está em ordem", () => {
  assert.equal(autorizacaoOk({ ...gestao, sublease_doc_tipo: "contrato_gestao" }), true);
  assert.equal(autorizacaoOk({ ...gestao, sublease_doc_tipo: "procuracao" }), true);
});

test("sublocação não exige tipo (só o arquivo e a declaração)", () => {
  assert.equal(autorizacaoOk({ ...gestao, ownership_type: "subleased", sublease_doc_tipo: null }), true);
});

test("tipoDocValido: só os dois tipos de gestão valem para administrado", () => {
  assert.equal(tipoDocValido("managed", "contrato_gestao"), true);
  assert.equal(tipoDocValido("managed", "procuracao"), true);
  assert.equal(tipoDocValido("managed", "autorizacao"), false);
  assert.equal(tipoDocValido("managed", "qualquer"), false);
  assert.equal(tipoDocValido("managed", undefined), false);
  assert.equal(tipoDocValido("subleased", undefined), true);
  assert.equal(tipoDocValido("own", undefined), true);
});

test("tipoDocParaGravar: o tipo só é gravado quando combina com a operação", () => {
  assert.equal(tipoDocParaGravar("managed", "procuracao"), "procuracao");
  assert.equal(tipoDocParaGravar("managed", "autorizacao"), null);
  assert.equal(tipoDocParaGravar("managed", "<script>"), null);
  assert.equal(tipoDocParaGravar("own", "procuracao"), null);
  assert.equal(tipoDocParaGravar("subleased", "procuracao"), "autorizacao");
});
