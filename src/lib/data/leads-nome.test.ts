/*
  Interessados: o dono vê o primeiro nome do inquilino antes do aceite e o nome
  completo depois — lido pelo servidor (a RLS de profiles não deixa o dono ler) e
  nunca com contato. Roda: node --test src/lib/data/leads-nome.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./leads.ts", import.meta.url), "utf8");

test("nome do inquilino vem do servidor, só dos inquilinos dos leads deste dono, só nome e categoria", () => {
  assert.doesNotMatch(src, /tenant:profiles!leads_tenant_id_fkey/);
  assert.match(src, /admin\.from\("profiles"\)\.select\("id, full_name, professional_category"\)\.in\("id", tenantIds\)/);
  assert.doesNotMatch(src, /select\([^)]*(email|phone)/);
  assert.match(src, /const tenantIds = \[\.\.\.new Set\(rows\.map\(\(r\) => r\.tenant_id\)\)\];/);
  assert.match(src, /\.eq\("owner_id", user\.id\)/);
});

test("primeiro nome antes do aceite; completo só depois", () => {
  assert.match(src, /if \(status === "accepted" && completo\) return completo;\s*return primeiroNome\(nome\);/);
  assert.match(src, /name: nomeExibido\(t\?\.full_name, r\.status\),/);
});
