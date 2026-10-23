import { test } from "node:test";
import assert from "node:assert/strict";
import { enderecoParaDocumento, faltaEnderecoDocumento, normalizarEnderecoDocumento, textoFaltaEndereco } from "./endereco-documento.ts";

test("L1-1: CEP com máscara vale; CEP curto falta", () => {
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400-100", rua: "Rua Goiás", numero: "120" }), []);
  assert.deepEqual(faltaEnderecoDocumento({ cep: " 38.400-100 ", rua: "Rua Goiás", numero: "120" }), []);
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400", rua: "Rua Goiás", numero: "120" }), ["cep"]);
});

test("L1-1: número dentro da rua é aceito (e sai da rua)", () => {
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "Rua Goiás, 120", numero: "" }), []);
  assert.deepEqual(normalizarEnderecoDocumento({ cep: "38400100", rua: "Rua Goiás, 120", numero: "" }), { cep: "38400100", rua: "Rua Goiás", numero: "120" });
  assert.equal(normalizarEnderecoDocumento({ rua: "Av. Rondon Pacheco 45 apto 3" }).numero, "45");
  assert.equal(normalizarEnderecoDocumento({ rua: "Rua Modesta Maria, nº 7" }).numero, "7");
  assert.equal(normalizarEnderecoDocumento({ rua: "Rua 7 de Setembro, 210B" }).numero, "210B");
  assert.deepEqual(normalizarEnderecoDocumento({ rua: "Rua Goiás 120" }), { cep: "", rua: "Rua Goiás", numero: "120" });
  // Rua cujo nome é só número não vira "número".
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "Rua 10", numero: "" }), ["numero"]);
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "Avenida", numero: "" }), ["numero"]);
});

test("L1-1: s/n vale como número", () => {
  for (const n of ["s/n", "S/N", "sn", "s/nº", "S/Nº"]) assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "Rua Goiás", numero: n }), [], n);
  assert.equal(normalizarEnderecoDocumento({ rua: "Rua Goiás, s/n" }).numero, "s/n");
});

test("L1-1: rua vazia e tudo vazio dizem o que falta, na ordem da tela", () => {
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "", numero: "120" }), ["rua"]);
  assert.deepEqual(faltaEnderecoDocumento({ cep: "38400100", rua: "Rua Goiás", numero: "" }), ["numero"]);
  assert.deepEqual(faltaEnderecoDocumento({}), ["cep", "rua", "numero"]);
  assert.equal(textoFaltaEndereco(["numero"]), "Falta: número");
  assert.equal(textoFaltaEndereco(["cep", "numero"]), "Falta: CEP e número");
  assert.equal(textoFaltaEndereco(["cep", "rua", "numero"]), "Falta: CEP, rua e número");
  assert.equal(textoFaltaEndereco([]), "");
});

test("L1-1: o endereço gravado do rascunho completa o que a tela trouxe vazio (salvo nunca trava)", () => {
  const salvo = { cep: "38400-100", rua: "Rua Goiás, 120, apto 302" };
  const e = enderecoParaDocumento({ cep: "", rua: "", numero: "" }, salvo);
  assert.deepEqual(e, { cep: "38400100", rua: "Rua Goiás", numero: "120" });
  assert.deepEqual(faltaEnderecoDocumento(e), []);
  // O que a pessoa digitou agora vence o salvo.
  assert.deepEqual(enderecoParaDocumento({ cep: "38401-000", rua: "Av. Brasil", numero: "9" }, salvo), { cep: "38401000", rua: "Av. Brasil", numero: "9" });
  // Rua restaurada sem número + número só no salvo.
  assert.deepEqual(enderecoParaDocumento({ cep: "38400100", rua: "Rua Goiás", numero: "" }, { numero: "120" }).numero, "120");
  assert.deepEqual(faltaEnderecoDocumento(enderecoParaDocumento({ cep: "", rua: "", numero: "" }, null)), ["cep", "rua", "numero"]);
});
