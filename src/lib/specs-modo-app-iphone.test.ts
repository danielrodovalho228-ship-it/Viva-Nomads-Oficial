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

test("t151 usa UA do app, mede tarefa longa e confere o título sem capa e o carregando", () => {
  const src = readFileSync(join(raiz, "tests", "e2e", "specs", "t151-modo-app-iphone.spec.ts"), "utf8");
  assert.match(src, /VivaNomadsApp\/1\.0\.4 \(expo\)/);
  assert.match(src, /vn_app/);
  assert.match(src, /longtask/);
  assert.match(src, /painel-capa/);
  assert.match(src, /bloqueios-carregando/);
});

// Ordem a1ed5fb3 (#691): t152 também roda no WebKit iPhone 13 (suspeita de bfcache).
test("t152 roda no projeto webkit-iphone do Playwright", () => {
  const cfg = readFileSync(join(raiz, "playwright.config.ts"), "utf8");
  const bloco = cfg.slice(cfg.indexOf('name: "webkit-iphone"'));
  assert.match(bloco.slice(0, 300), /152-barra-fixa-imovel/);
});

// Prompt 42, item 2: as telas logadas não têm mais capa; t119 confere a AUSÊNCIA dela (e o título visível).
test("t119 confere que as telas logadas abrem sem capa, com o h1 visível", () => {
  const src = readFileSync(join(raiz, "tests", "e2e", "specs", "t119-painel-capas.spec.ts"), "utf8");
  assert.match(src, /painel-capa"\]'\)\)\.toHaveCount\(0/);
  assert.match(src, /locator\("main h1:visible"\)/);
});

// Ordem ec7988fe, item 3: no lab a conta de teste do proprietário não tem imóvel e a
// Disponibilidade era PULADA (t151: 1 passou / 3 pularam). O spec cria o próprio imóvel.
test("t151 cria o próprio imóvel no laboratório e não pula a Disponibilidade", () => {
  const src = readFileSync(join(raiz, "tests", "e2e", "specs", "t151-modo-app-iphone.spec.ts"), "utf8");
  assert.match(src, /criarImovelPronto/);
  assert.match(src, /NO_LABORATORIO/);
  assert.match(src, /apagarContas/);
});

// Ordem 75553f0a/laboratório verde (capa visível) → Prompt 42: t151 e t86 conferem que a capa NÃO existe.
for (const arq of ["t151-modo-app-iphone", "t86-decisao-avatar-alt"]) {
  test(`${arq} confere que a capa não aparece`, () => {
    const src = readFileSync(join(raiz, "tests", "e2e", "specs", `${arq}.spec.ts`), "utf8");
    assert.match(src, /painel-capa"\]'\)\)\.toHaveCount\(0/);
    assert.doesNotMatch(src, /painel-capa"\]:visible/);
  });
}
