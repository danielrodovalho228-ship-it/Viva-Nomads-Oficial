/* Roda: node --test src/lib/data/locacoes-titulo.test.ts — E182: o cartão da estadia sempre com o nome do imóvel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Minhas estadias: imóvel pausado/encerrado (fora do RLS do morador) ainda mostra o título — só dos contratos dele", () => {
  const s = readFileSync(new URL("./contratos-actions.ts", import.meta.url), "utf8");
  const f = s.slice(s.indexOf("export async function getMinhasLocacoes"), s.indexOf("export async function getMeusContratos"));
  // A lista continua filtrada pelo próprio morador; o servidor completa só os que vieram sem título.
  assert.match(f, /\.eq\("tenant_id", user\.id\)/);
  assert.match(f, /const semTitulo = /);
  assert.match(f, /admin\.from\("properties"\)\.select\("id, title, owner_id"\)\.in\("id", semTitulo\)/);
  assert.match(f, /doServidor\.get\(String\(c\.property_id\)\)/);
});
