import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

// Ordem 5af5f167 (faixa D): o roteiro do admin cobre TODA página de src/app/(dashboard)/admin.
const RAIZ = "src/app/(dashboard)/admin";
const DOC = "docs/proposta-ambiente-qa-admin.md";

function rotasAdmin(dir = RAIZ, prefixo = "/admin"): string[] {
  const rotas: string[] = [];
  if (existsSync(join(dir, "page.tsx"))) rotas.push(prefixo);
  for (const nome of readdirSync(dir)) {
    const sub = join(dir, nome);
    if (statSync(sub).isDirectory()) rotas.push(...rotasAdmin(sub, `${prefixo}/${nome}`));
  }
  return rotas;
}

test("5af5f167: a proposta do ambiente de QA existe e lista cada rota do /admin", () => {
  assert.ok(existsSync(DOC), `${DOC} não existe`);
  const doc = readFileSync(DOC, "utf8");
  const rotas = rotasAdmin();
  assert.ok(rotas.length >= 20, "esperava achar as páginas do admin");
  const faltando = rotas.filter((r) => !doc.includes(`\`${r}\``));
  assert.deepEqual(faltando, [], `rotas do admin sem roteiro: ${faltando.join(", ")}`);
});

test("5af5f167: a proposta proíbe admin de teste em produção e não expõe segredo", () => {
  const doc = readFileSync(DOC, "utf8");
  assert.match(doc, /NÃO criar admin de teste em produção/);
  assert.match(doc, /AMBIENTE DE TESTE/);
  assert.doesNotMatch(doc, /[A-Z2-7]{32}/, "parece um segredo TOTP base32");
});
