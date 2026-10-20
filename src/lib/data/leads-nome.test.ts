/*
  Interessados (prompt 6, 17/10 — substitui a regra antiga "primeiro nome antes, completo depois"):
  antes do aceite o dono vê "Candidato(a)", sem nome nem foto; depois, nome curto e foto. Lido pelo
  servidor (a RLS de profiles não deixa o dono ler) e nunca com contato.
  Roda: node --test src/lib/data/leads-nome.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./leads.ts", import.meta.url), "utf8");

test("nome do inquilino vem do servidor, só dos inquilinos dos leads deste dono, só nome e categoria", () => {
  assert.doesNotMatch(src, /tenant:profiles!leads_tenant_id_fkey/);
  assert.match(src, /admin\.from\("profiles"\)\.select\("id, full_name, professional_category, avatar_url, created_at"\)\.in\("id", tenantIds\)/);
  assert.doesNotMatch(src, /select\([^)]*(email|phone)/);
  assert.match(src, /const tenantIds = \[\.\.\.new Set\(rows\.map\(\(r\) => r\.tenant_id\)\)\];/);
  assert.match(src, /\.eq\("owner_id", user\.id\)/);
});

test("antes do aceite 'Candidato(a)' sem foto; depois nome curto e foto (cartaoCandidato)", () => {
  assert.match(src, /cartaoCandidato\(/);
  assert.match(src, /r\.status === "accepted",\s*\);/);
  assert.match(src, /name: cartao\.titulo,/);
  assert.match(src, /fotoUrl: cartao\.fotoUrl,/);
  // Foto assinada só para lead aceito.
  assert.match(src, /\.filter\(\(r\) => r\.status === "accepted"\)/);
});
