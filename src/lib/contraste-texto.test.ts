/*
  Varredura de contraste (02/11, Pista A, WCAG AA: 4,5:1 para texto comum). Branco a 70% sobre o verde da marca
  (#1c6b3a) dá 4,1:1 e a 60%, 3,45:1 — reprovam. Branco a 85% dá 5,2:1. Cinza de texto a 60% sobre branco (12 px) dá
  4,3:1 — vira o token da casa `text-muted` (#3f3f3f).
  Telas: Início do painel (verificação), Indicações (código), página do polo (trilha e público), Mensagens (aviso de
  documentos), Fotógrafos (contato depois do aceite).
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const lum = (c: number[]) => {
  const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const razao = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const mistura = (fg: number[], bg: number[], a: number) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const FOREST = [0x1c, 0x6b, 0x3a];
const BRANCO = [255, 255, 255];

test("a regra: branco a 85% sobre o verde passa (≥ 4,5); a 70% e a 60% não", () => {
  assert.ok(razao(mistura(BRANCO, FOREST, 0.85), FOREST) >= 4.5);
  assert.ok(razao(mistura(BRANCO, FOREST, 0.7), FOREST) < 4.5);
  assert.ok(razao(mistura(BRANCO, FOREST, 0.6), FOREST) < 4.5);
  assert.ok(razao([0x3f, 0x3f, 0x3f], BRANCO) >= 4.5, "text-muted sobre branco");
});

test("as cinco telas usam a cor que passa", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx"), /<p className="text-sm text-white\/85">\n\s*Complete a verificação/);
  assert.match(ler("src/app/(dashboard)/dashboard/indicacoes/page.tsx"), /<p className="mt-1 text-sm text-white\/85">\n\s*Seu código:/);
  const polo = ler("src/app/(public)/cidades/[cidade]/[polo]/page.tsx");
  assert.match(polo, /<nav className="text-sm text-white\/85">/);
  assert.match(polo, /<p className="mt-3 max-w-2xl text-sm text-white\/85">\{p\.publico\}<\/p>/);
  assert.match(ler("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx"), /text-xs text-muted" data-testid="mensagens-aviso-documentos"/);
  assert.match(ler("src/app/(public)/parceiros/fotografos/page.tsx"), /text-xs text-muted" data-testid="fotografos-contato-aceite"/);
});
