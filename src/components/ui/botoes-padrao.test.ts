/*
  Ordem c67e818f (Daniel): um botão primário e um secundário iguais no site
  inteiro; texto de botão nunca quebra; logo nunca encosta nos links do header.
  Roda: node --test src/components/ui/botoes-padrao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const botao = ler("components/ui/button.tsx");

function arquivos(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("primário único: primary, accent e gold usam a MESMA classe; outline = secondary", () => {
  assert.match(botao, /primary: PRIMARY,\s*accent: PRIMARY,\s*gold: PRIMARY,/);
  assert.match(botao, /secondary: SECONDARY,\s*outline: SECONDARY,/);
  assert.match(botao, /const PRIMARY = "bg-blue-500 text-white/);
  assert.match(botao, /const SECONDARY = "border border-blue-500 bg-white text-blue-500/);
});

test("forma comum: cantos 8 px, semibold, sem quebra de linha, não encolhe, foco visível", () => {
  const base = botao.match(/const base =\s*"([^"]+)"/)?.[1] ?? "";
  for (const c of ["whitespace-nowrap", "shrink-0", "rounded-lg", "font-semibold", "focus-visible:ring-2", "disabled:opacity-50"]) {
    assert.ok(base.split(/\s+/).includes(c), `base sem ${c}`);
  }
  assert.match(botao, /sm: "h-10 /);
  assert.match(botao, /md: "h-12 /);
  assert.match(botao, /lg: "h-14 /);
});

test("nenhum botão feito à mão com o verde-marca/preto: todos via Button, ButtonLink ou buttonClasses", () => {
  // Exceção: botões só de ícone (quadrados/redondos, sem texto), ex.: enviar mensagem.
  const soIcone = /\bh-(\d+) w-\1\b/;
  const achados: string[] = [];
  for (const f of arquivos(SRC)) {
    if (f.endsWith("ui/button.tsx")) continue;
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (!/<(button|Link|a)\b/.test(l) && !/^\s*className="/.test(l)) return;
        const cls = l.match(/className="([^"]*)"/)?.[1] ?? "";
        if (/\bbg-(forest|night|blue-500|green-500)\b/.test(cls) && /\b(px-\d|h-1[0-4])\b/.test(cls) && /\btext-(white|night)\b/.test(cls)) {
          if (!soIcone.test(cls)) achados.push(`${f.replace(SRC, "")}:${i + 1}: ${l.trim().slice(0, 90)}`);
        }
      });
  }
  assert.deepEqual(achados, [], "use Button/ButtonLink/buttonClasses");
});

test("botões não recolorem o primário por className (só ações de excluir podem ficar em vermelho)", () => {
  const achados: string[] = [];
  for (const f of arquivos(SRC)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/<(Button|ButtonLink)\b[^>]*?className="([^"]*)"/g)) {
      if (/\bbg-red-/.test(m[2])) continue; // ação de excluir (vermelha)
      const extra = m[2].split(/\s+/).filter((c) => /^(hover:)?(bg|text|border)-(?!red)/.test(c) && !/^text-(left|center|right)$/.test(c));
      if (extra.length) achados.push(`${f.replace(SRC, "")}: ${extra.join(" ")}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("header: logo não encolhe e tem distância fixa dos links; links e ações não quebram", () => {
  const nav = ler("components/layout/navbar.tsx");
  assert.match(nav, /<Logo className="shrink-0" \/>/);
  assert.match(nav, /<nav className="flex h-18 w-full items-center gap-10 px-5/);
  assert.match(nav, /data-testid="nav-acoes" className="hidden shrink-0/);
  assert.match(nav, /whitespace-nowrap text-sm font-medium/);
});
