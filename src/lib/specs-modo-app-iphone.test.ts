import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Ordem ec7988fe: a prova do modo app é em WebKit/iPhone com o UA do app, e o
// projeto webkit-iphone precisa rodar a spec (senão ela nunca executa no lab).
const raiz = process.cwd();

test("t151 roda no projeto webkit-iphone do Playwright", () => {
  const cfg = readFileSync(join(raiz, "playwright.config.ts"), "utf8");
  const bloco = cfg.slice(cfg.indexOf('name: "webkit-iphone"'));
  assert.match(bloco.slice(0, 300), /151-modo-app-iphone/);
});

test("t151 usa UA do app, mede tarefa longa e confere capa e carregando", () => {
  const src = readFileSync(join(raiz, "tests", "e2e", "specs", "t151-modo-app-iphone.spec.ts"), "utf8");
  assert.match(src, /VivaNomadsApp\/1\.0\.4 \(expo\)/);
  assert.match(src, /vn_app/);
  assert.match(src, /longtask/);
  assert.match(src, /painel-capa/);
  assert.match(src, /bloqueios-carregando/);
});
