import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("7ffea8c7: a barra Comparar fica acima das abas do celular (não usa bottom-3 fixo)", () => {
  const src = ler("components/busca/barra-comparar.tsx");
  assert.match(src, /vn-barra-comparar/);
  assert.doesNotMatch(src, /bottom-3/);
  const css = ler("app/globals.css");
  assert.match(css, /--altura-abas:\s*3\.5rem/);
  assert.match(css, /\.vn-barra-comparar\s*\{\s*bottom: calc\(var\(--altura-abas\) \+ env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem\)/);
  // computador: 12 px do rodapé (sem regressão)
  assert.match(css, /min-width: 768px\)\s*\{\s*\.vn-barra-comparar\s*\{\s*bottom: 0\.75rem/);
});

test("7ffea8c7: com a barra visível o 'Fale com a Viva' sobe e o fim da página ganha folga (só celular)", () => {
  const css = ler("app/globals.css");
  assert.match(css, /max-width: 767px\)\s*\{\s*body:has\(\[data-testid="barra-comparar"\]\)\s*\{\s*--ajuda-bottom: 10rem/);
  assert.match(css, /padding-bottom: calc\(var\(--altura-abas\) \+ 6rem/);
});
