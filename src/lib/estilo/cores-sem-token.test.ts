/**
 * Varredura (Pista A, 04/11): classe de cor que aponta para um tom que o tema NÃO define não gera CSS nenhum — o fundo,
 * a borda ou o texto simplesmente não aparecem (foi a causa do E502: `bg-sage-50` nos avisos não lidos). Este teste
 * varre o src e exige que toda classe das famílias próprias da casa (forest, sage, champagne, surface, ink, line,
 * muted, night, apoio, divisor) use um token que exista em globals.css. A paleta padrão do Tailwind (amber, red…) segue
 * valendo e fica fora da conta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;
const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
const TOKENS = new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const FAMILIAS = ["forest", "sage", "champagne", "surface", "ink", "line", "muted", "night", "apoio", "divisor"];
const PREFIXO = "(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|decoration|placeholder|accent|caret|shadow)";
const CLASSE = new RegExp(`(?<![\\w-])${PREFIXO}-((?:${FAMILIAS.join("|")})(?:-[a-z0-9]+)*)(?:\\/\\d+)?(?![\\w-])`, "g");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx?|css)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("toda classe de cor das famílias da casa usa um token que existe no tema", () => {
  const sem: string[] = [];
  for (const p of arquivos(RAIZ)) {
    readFileSync(p, "utf8")
      .split("\n")
      .forEach((linha, i) => {
        for (const m of linha.matchAll(CLASSE)) if (!TOKENS.has(m[1])) sem.push(`${p.slice(RAIZ.length)}:${i + 1} ${m[0]}`);
      });
  }
  assert.deepEqual(sem, []);
});

test("o detector reconhece classe sem token e aceita as que existem", () => {
  const achar = (s: string) => [...s.matchAll(CLASSE)].map((m) => m[1]).filter((t) => !TOKENS.has(t));
  assert.deepEqual(achar("bg-sage-50 hover:border-sage-300 text-ink-soft"), ["sage-50", "sage-300", "ink-soft"]);
  assert.deepEqual(achar("bg-sage-100 border-forest/30 text-muted bg-surface-2 bg-amber-50"), []);
});
