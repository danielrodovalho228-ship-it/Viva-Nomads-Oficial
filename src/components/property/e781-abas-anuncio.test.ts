/* E781 — as abas do anúncio rolam até a seção por código, com compensação do cabeçalho, e conferem depois do carregamento. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const f = readFileSync(new URL("./nav-secoes.tsx", import.meta.url), "utf8");
test("o toque na aba não depende só do salto nativo do #hash", () => {
  assert.match(f, /onClick=\{\(e\) => irPara\(e, s\.id\)\}/);
  assert.match(f, /e\.preventDefault\(\)/);
  assert.match(f, /window\.scrollTo\(\{ top: window\.scrollY \+ delta, behavior: "auto" \}\)/);
  assert.match(f, /history\.replaceState\(null, "", `#\$\{id\}`\)/);
});
test("a compensação usa a base das abas presas e a posição é conferida de novo (layout que muda ao carregar)", () => {
  assert.match(f, /nav \? nav\.bottom : 120/);
  assert.match(f, /conferir/);
});
test("a aba ativa continua seguindo a seção visível ao rolar", () => {
  assert.match(f, /addEventListener\("scroll", atualizar/);
});
