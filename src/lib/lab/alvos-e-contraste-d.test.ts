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

/* Lab verde (faixa D) — t251/t259 de 22/10: violações reais que o laboratório apontou. */
test("alvoDoControle: caixa e opção valem pelo rótulo; texto e botão, pelo campo", async () => {
  const { alvoDoControle, alvoPequeno } = await import("./alvos-toque.ts");
  const caixa = { largura: 20, altura: 20 };
  const rotulo = { largura: 300, altura: 44 };
  assert.deepEqual(alvoDoControle("checkbox", caixa, rotulo), rotulo);
  assert.deepEqual(alvoDoControle("radio", { largura: 1, altura: 1 }, rotulo), rotulo);
  assert.deepEqual(alvoDoControle("checkbox", caixa, null), caixa);
  assert.deepEqual(alvoDoControle("text", caixa, rotulo), caixa);
  assert.equal(alvoPequeno({ seletor: "x", ...alvoDoControle("checkbox", caixa, { largura: 100, altura: 28 }) }), true);
  assert.equal(alvoPequeno({ seletor: "x", ...alvoDoControle("checkbox", caixa, rotulo) }), false);
});

test("/parceiros: o título 'Dúvidas' fica fora da <dl> (axe definition-list)", () => {
  const s = readFileSync("src/app/(public)/parceiros/page.tsx", "utf8");
  const dl = /<dl className="mt-4 space-y-4"[^>]*>([\s\S]*?)<\/dl>/.exec(s)?.[1] ?? "";
  assert.ok(dl.length > 0 && !/<h3/.test(dl));
});

test("cartão da busca: carrossel de fotos rolável tem acesso por teclado (axe scrollable-region-focusable)", () => {
  const s = readFileSync("src/components/property/fotos-cartao.tsx", "utf8");
  assert.match(s, /tabIndex: 0/);
  assert.match(s, /"aria-label"/);
});

test("comparar na busca tem rótulo de 44 px; números da home e migalha da cidade com contraste", () => {
  assert.match(readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8"), /<label className="mt-2 flex min-h-11 [^"]*">\s*<input\s+type="checkbox"/);
  assert.ok(!/tabular-nums text-line/.test(readFileSync("src/app/(public)/page.tsx", "utf8")));
  assert.ok(!/bg-champagne\/15 text-champagne-600/.test(readFileSync("src/app/(public)/como-funciona/page.tsx", "utf8")));
  assert.ok(!/text-white\/60/.test(readFileSync("src/app/(public)/cidades/[cidade]/page.tsx", "utf8")));
  assert.ok(contraste("#2E7D5B", "#FFFFFF") >= 4.5);
  assert.ok(contraste("#1C6B3A", "#EEF6EF") >= 4.5);
});

test("/auth: botões de texto soltos têm 44 px (min-h-11)", () => {
  const s = readFileSync("src/app/auth/page.tsx", "utf8");
  const soltos = s.match(/className="[^"]*font-medium text-forest hover:text-blue-700"/g) ?? [];
  assert.ok(soltos.length > 0);
  for (const b of soltos) assert.match(b, /min-h-11/);
});
