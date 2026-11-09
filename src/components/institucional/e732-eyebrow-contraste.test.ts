// E732 (QA 08/11): o rótulo verde ("Para empresas") sobre a foto do banner tinha 3,60:1 (texto pequeno pede 4,5:1). A foto é o fundo
// e varia de página para página (decisão do Daniel, 09/11: a cor do texto é text-white/90, a da Pista QA); por isso o rótulo ganha uma pastilha escura própria, e o contraste não depende mais da foto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/components/institucional/banner-topo.tsx", "utf8");

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const razao = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

test("E732: o rótulo do banner fica numa pastilha escura (night/80), não direto sobre a foto", () => {
  assert.match(s, /className="inline-block rounded-full bg-night\/80 px-3 py-1 text-sm font-semibold text-white/90" data-testid="banner-topo-eyebrow"/);
  assert.doesNotMatch(s, /<p className="text-sm font-semibold text-green-300">/);
});

test("E732: com a pastilha, o pior caso (foto branca sob o degradê night/65 do banner) passa de 4,5:1", () => {
  const verde = 0.9 * 1 + 0.1 * lum("#0b1220"); // E732 (decisão do Daniel, 09/11): text-white/90 — branco a 90%, sobre a pastilha
  const night = lum("#0b1220"); // aproximação do night
  const sobDegrade = 0.65 * night + 0.35 * 1; // o banner escurece a foto em 65% (night/65)
  const pior = 0.8 * night + 0.2 * sobDegrade; // pastilha 80% por cima
  assert.ok(razao(verde, pior) >= 4.5, `razão ${razao(verde, pior).toFixed(2)}`);
});
