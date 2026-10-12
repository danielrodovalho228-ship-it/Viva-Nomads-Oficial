import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const RAIZ = join(process.cwd(), "src");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(tsx?|css)$/.test(nome) && !nome.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

test("nenhum arquivo do app usa next/font/google (build sem acesso ao Google Fonts)", () => {
  const usam = arquivos(RAIZ).filter((f) => readFileSync(f, "utf8").includes("next/font/google"));
  assert.deepEqual(usam, []);
});

test("todo .woff2 referenciado por localFont existe no repositório", () => {
  let total = 0;
  for (const f of arquivos(RAIZ)) {
    const txt = readFileSync(f, "utf8");
    for (const m of txt.matchAll(/path:\s*"([^"]+\.woff2)"/g)) {
      total++;
      assert.ok(existsSync(resolve(dirname(f), m[1])), `${f}: fonte ausente ${m[1]}`);
    }
  }
  assert.ok(total >= 13, "esperava ao menos 13 pesos de fonte referenciados");
});
