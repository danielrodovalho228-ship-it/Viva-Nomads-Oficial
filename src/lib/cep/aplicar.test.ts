import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarResultadoCep, digitadoPelaPessoa, type CampoEndereco } from "./aplicar.ts";

const SANTA_MONICA = { tipo: "rua" as const, rua: "Avenida João Naves de Ávila", bairro: "Santa Mônica", cidade: "Uberlândia", uf: "MG" };
const AUTOFILL = { rua: "Avenida das Torres", bairro: "Centro", cidade: "Sarandi" };

test("p22 — autofill do navegador (nada digitado): o CEP SUBSTITUI rua, bairro e cidade (38408-000 → Santa Mônica, Uberlândia/MG)", () => {
  assert.deepEqual(aplicarResultadoCep(SANTA_MONICA, AUTOFILL, new Set()), {
    uf: "MG",
    cidade: "Uberlândia",
    rua: "Avenida João Naves de Ávila",
    bairro: "Santa Mônica",
  });
});

test("p22 — o que a pessoa DIGITOU fica; bairro digitado diferente vira pergunta; campo digitado e apagado recebe o do CEP", () => {
  const digitados = new Set<CampoEndereco>(["rua", "bairro"]);
  const a = aplicarResultadoCep(SANTA_MONICA, { rua: "Rua que eu digitei", bairro: "Tibery", cidade: "Sarandi" }, digitados);
  assert.equal(a.rua, undefined);
  assert.equal(a.bairro, undefined);
  assert.equal(a.perguntarBairro, "Santa Mônica");
  assert.equal(a.cidade, "Uberlândia", "cidade não digitada: troca");
  assert.equal(aplicarResultadoCep(SANTA_MONICA, { rua: "", bairro: "", cidade: "" }, new Set<CampoEndereco>(["rua"])).rua, SANTA_MONICA.rua);
});

test("p22 — CEP não encontrado não mexe em nada; CEP da cidade toda tira a rua que veio do autofill", () => {
  assert.deepEqual(aplicarResultadoCep({ tipo: "nao_encontrado" }, AUTOFILL, new Set()), {});
  assert.deepEqual(aplicarResultadoCep({ tipo: "cidade", cidade: "Uberlândia", uf: "MG" }, AUTOFILL, new Set()), { uf: "MG", cidade: "Uberlândia", rua: "" });
  assert.equal(aplicarResultadoCep({ tipo: "cidade", cidade: "Uberlândia", uf: "MG" }, AUTOFILL, new Set<CampoEndereco>(["rua"])).rua, undefined);
});

test("p22 — digitar, colar, apagar e escolher na lista contam como digitado; o 'input' do autofill (sem inputType) não", () => {
  for (const inputType of ["insertText", "insertFromPaste", "deleteContentBackward", "insertReplacementText"]) {
    assert.equal(digitadoPelaPessoa({ inputType }), true, inputType);
  }
  assert.equal(digitadoPelaPessoa({ type: "input" }), false);
  assert.equal(digitadoPelaPessoa({ inputType: "" }), false);
  assert.equal(digitadoPelaPessoa(null), false);
});
