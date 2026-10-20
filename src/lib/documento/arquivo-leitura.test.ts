import { test } from "node:test";
import assert from "node:assert/strict";
import { precisaReduzirImagem, IMAGEM_LADO_MAX_PX, IMAGEM_MAX_BYTES_ENVIO } from "./arquivo-leitura.ts";

test("p22 — foto de celular grande (mais de 5 MB, ou 4000 px) é reduzida antes da leitura; foto pequena vai como está", () => {
  assert.ok(IMAGEM_MAX_BYTES_ENVIO * (4 / 3) < 5 * 1024 * 1024, "em base64 continua abaixo de 5 MB");
  assert.equal(precisaReduzirImagem(5.5 * 1024 * 1024, 3000, 4000), true);
  assert.equal(precisaReduzirImagem(1.2 * 1024 * 1024, 4032, 3024), true, "lado grande");
  assert.equal(precisaReduzirImagem(800 * 1024, 1600, 1200), false);
  assert.equal(precisaReduzirImagem(800 * 1024, IMAGEM_LADO_MAX_PX, 1000), false);
});
