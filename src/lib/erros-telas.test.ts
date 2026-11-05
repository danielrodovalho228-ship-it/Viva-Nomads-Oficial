/*
  Auditoria de páginas de erro dos fluxos logados (rodada 1): (1) toda tela de erro mostra o código de referência que o Next
  entrega (digest), para a equipe achar a causa no log; (2) o admin tem o próprio 404, fora da vitrine pública.
  Roda: node --test src/lib/erros-telas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { codigoDoErro } from "./erro-codigo.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("codigoDoErro: devolve o digest limpo; sem digest ou curto demais, null", () => {
  assert.equal(codigoDoErro({ digest: "1234567890" }), "1234567890");
  assert.equal(codigoDoErro({ digest: "ab-CD_9988 <script>" }), "ab-CD_9988script");
  assert.equal(codigoDoErro({ digest: "x".repeat(60) })?.length, 24);
  assert.equal(codigoDoErro({ digest: "ab" }), null);
  assert.equal(codigoDoErro(new Error("falhou")), null);
  assert.equal(codigoDoErro(null), null);
  assert.equal(codigoDoErro({ digest: 12345678 }), null);
});

test("as quatro telas de erro e o erro geral mostram o código de referência", () => {
  for (const p of ["src/app/error.tsx", "src/app/(public)/error.tsx", "src/app/(dashboard)/dashboard/error.tsx", "src/app/(dashboard)/admin/error.tsx"]) {
    const f = ler(p);
    assert.match(f, /\{ error, unstable_retry, reset \}/, p);
    assert.match(f, /<CodigoDoErro error=\{error\} \/>/, p);
  }
  const g = ler("src/app/global-error.tsx");
  assert.match(g, /codigoDoErro\(error\)/);
  assert.match(g, /data-testid="erro-codigo"/);
  assert.match(ler("src/components/ui/codigo-do-erro.tsx"), /Código para a equipe/);
});

test("o admin tem 404 próprio na casca; o notFound() do layout segue na 404 da raiz (a área não se revela)", () => {
  const nf = ler("src/app/(dashboard)/admin/not-found.tsx");
  assert.match(nf, /data-testid="admin-nao-encontrado"/);
  assert.match(nf, /title: "Página não encontrada"/);
  assert.match(nf, /href="\/admin"/);
  assert.doesNotMatch(nf, /PropertyCard|listProperties|para-proprietarios/); // nada de vitrine
  assert.match(ler("src/app/(dashboard)/admin/layout.tsx"), /role !== "admin"\) notFound\(\)/);
});
