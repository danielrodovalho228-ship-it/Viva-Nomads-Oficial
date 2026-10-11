import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { imagemQuebrada } from "./foto.ts";

test("imagem completa sem largura natural está quebrada (fallback hexágono)", () => {
  assert.equal(imagemQuebrada({ complete: true, naturalWidth: 0 }), true);
});

test("imagem carregando, carregada ou ausente não é tratada como quebrada", () => {
  assert.equal(imagemQuebrada({ complete: false, naturalWidth: 0 }), false);
  assert.equal(imagemQuebrada({ complete: true, naturalWidth: 160 }), false);
  assert.equal(imagemQuebrada(null), false);
});

test("a foto do Rogério existe em public/agentes", () => {
  assert.equal(existsSync("public/agentes/rogerio.webp"), true);
});
