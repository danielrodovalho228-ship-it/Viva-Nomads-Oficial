import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const VERDE_WORDMARK_SOBRE_CLARO = /VERDE_WORDMARK_SOBRE_CLARO = "(#[0-9A-Fa-f]{6})"/.exec(readFileSync("src/components/ui/logo.tsx", "utf8"))?.[1] ?? "#5DBB1E";

/* Lab verde (faixa D): t251 (axe color-contrast no logo) e t259 (alvos de toque de 44 px no celular). */
const luz = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => (Math.max(luz(a), luz(b)) + 0.05) / (Math.min(luz(a), luz(b)) + 0.05);

test("wordmark verde sobre branco e sobre o creme do cabeçalho passa de 4,5:1", () => {
  assert.ok(contraste(VERDE_WORDMARK_SOBRE_CLARO, "#FFFFFF") >= 4.5);
  assert.ok(contraste(VERDE_WORDMARK_SOBRE_CLARO, "#F5F1E8") >= 4.5);
});

test("botões de ícone do celular têm 44 px (h-11 w-11), não 40", () => {
  for (const f of ["src/components/layout/navbar.tsx", "src/components/layout/mobile-header.tsx", "src/components/favorite-button.tsx"]) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/grid h-10 w-10/.test(s), `${f} ainda tem botão de 40 px`);
    assert.match(s, /grid h-11 w-11/, f);
  }
  assert.match(readFileSync("src/components/busca/salvar-busca.tsx", "utf8"), /min-h-11/);
});
