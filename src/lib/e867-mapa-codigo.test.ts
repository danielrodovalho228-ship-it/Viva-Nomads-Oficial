/*
  E867 — a documentação técnica (docs/e867-documentacao-tecnica.md) é também o mapa do código. Este teste confere os
  números marcados com † e os caminhos citados contra o repositório: se o código mudar, o teste avisa que o documento
  ficou velho. (Os números do banco de produção são lidos por SQL e não entram aqui.)
  Roda: node --test src/lib/e867-mapa-codigo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;
const doc = readFileSync(join(RAIZ, "docs/e867-documentacao-tecnica.md"), "utf8");

function contar(dir: string, nome: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f);
    return n + (statSync(p).isDirectory() ? contar(p, nome) : f === nome ? 1 : 0);
  }, 0);
}

test("páginas públicas, de entrada e rotas de API batem com o documento", () => {
  const pub = contar(join(RAIZ, "src/app/(public)"), "page.tsx");
  const authP = contar(join(RAIZ, "src/app/auth"), "page.tsx");
  const authR = contar(join(RAIZ, "src/app/auth"), "route.ts");
  const api = contar(join(RAIZ, "src/app/api"), "route.ts");
  assert.ok(doc.includes(`\`src/app/(public)\`, ${pub} páginas †`), `públicas: ${pub}`);
  assert.ok(doc.includes(`\`src/app/auth\`, ${authP} páginas e ${authR} rotas †`), `auth: ${authP}/${authR}`);
  assert.ok(doc.includes(`com ${api} rotas †`), `api: ${api}`);
});

test("crons da Vercel, workflows e arquivos de migração batem com o documento", () => {
  const crons = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf8")).crons as { path: string }[];
  assert.ok(doc.includes(`${crons.length} rotas † em \`vercel.json\``), `crons: ${crons.length}`);
  for (const c of crons) assert.ok(doc.includes(`| \`${c.path.replace("/api/cron/", "")}\` |`), c.path);
  const wf = readdirSync(join(RAIZ, ".github/workflows")).filter((f) => f.endsWith(".yml")).length;
  assert.ok(doc.includes(`${wf} fluxos †`), `workflows: ${wf}`);
  const mig = readdirSync(join(RAIZ, "supabase/migrations")).filter((f) => f.endsWith(".sql")).length;
  assert.ok(doc.includes(`${mig} arquivos \`.sql\` †`), `migrações: ${mig}`);
});

test("todo caminho citado no mapa do código existe", () => {
  const caminhos = [...doc.matchAll(/`((?:src|supabase|docs|tests)\/[^`*<>\s]+?)`/g)].map((m) => m[1].replace(/\/$/, ""));
  assert.ok(caminhos.length > 25, `caminhos citados: ${caminhos.length}`);
  // Modelos de nome ("NNNN_*.sql", "aplicar-NNNN.sql") não são caminhos reais.
  const faltando = caminhos.filter((c) => !/NNNN/.test(c) && !existsSync(join(RAIZ, c)));
  assert.deepEqual(faltando, []);
});
