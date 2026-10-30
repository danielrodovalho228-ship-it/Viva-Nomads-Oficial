/*
  E282 — Vercel Web Analytics: medição padrão no layout raiz, só nos builds da Vercel; sem cookies e sem eventos
  customizados por agora. Roda: node --test src/lib/analytics-vercel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(p, "utf8");

test("E282: @vercel/analytics fixado e <Analytics /> no layout raiz, só na Vercel", () => {
  const pkg = JSON.parse(ler("package.json")) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies["@vercel/analytics"], "2.0.1");
  const lock = JSON.parse(ler("package-lock.json")) as { packages: Record<string, { version?: string; dependencies?: Record<string, string> }> };
  assert.equal(lock.packages[""].dependencies?.["@vercel/analytics"], "2.0.1");
  assert.equal(lock.packages["node_modules/@vercel/analytics"]?.version, "2.0.1");
  const layout = ler("src/app/layout.tsx");
  assert.match(layout, /import \{ Analytics \} from "@vercel\/analytics\/next";/);
  assert.match(layout, /\{process\.env\.VERCEL === "1" && <Analytics \/>\}\s*<\/body>/);
  // Medição padrão: sem props (sem beforeSend/mode/debug) e uma vez só.
  assert.equal((layout.match(/<Analytics/g) ?? []).length, 1);
});

test("E282: nenhum evento customizado (track) por agora", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n)) arquivos.push(p);
    }
  };
  andar("src");
  const comTrack = arquivos.filter((p) => /from "@vercel\/analytics(\/[a-z]+)?"/.test(ler(p)) && /\btrack\b/.test(ler(p)));
  assert.deepEqual(comTrack, []);
});
