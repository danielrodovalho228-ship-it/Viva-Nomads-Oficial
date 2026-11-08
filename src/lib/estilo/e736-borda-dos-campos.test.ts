// E736 (lista-master 08/11): as bordas dos campos de formulário usavam o --color-line (#ddd), com 1,25–1,36:1 de contraste (praticamente
// invisíveis). Campo precisa de 3:1 (WCAG 1.4.11). Token novo --color-campo-borda, só para campo; o --color-line dos demais usos fica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const razao = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test("E736: o token da borda do campo passa de 3:1 no branco e no surface-2, e o --color-line antigo não passava", () => {
  const campo = css.match(/--color-campo-borda:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
  const surface2 = css.match(/--color-surface-2:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
  assert.ok(campo, "token existe");
  assert.ok(razao(campo, "#ffffff") >= 3, `branco ${razao(campo, "#ffffff").toFixed(2)}`);
  assert.ok(razao(campo, surface2) >= 3, `surface-2 ${razao(campo, surface2).toFixed(2)}`);
  assert.ok(razao("#dddddd", "#ffffff") < 1.5, "o line antigo tinha ~1,3:1");
});

test("E736: a regra vale para input de texto, select e textarea com border-line, fora de @layer, sem pegar campo em foco nem caixa de marcar", () => {
  const regra = css.slice(css.indexOf("E736 —"));
  assert.match(regra, /input\[class~="border-line"\]:not\(:focus\):not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(regra, /select\[class~="border-line"\]:not\(:focus\)/);
  assert.match(regra, /textarea\[class~="border-line"\]:not\(:focus\)/);
  assert.match(regra, /border-color: var\(--color-campo-borda\)/);
  assert.doesNotMatch(regra, /@layer\s+\w+\s*\{/); // sem bloco @layer (o comentário pode citar a palavra)
  assert.match(css, /--color-line: #dddddd/); // o token geral não muda
});
