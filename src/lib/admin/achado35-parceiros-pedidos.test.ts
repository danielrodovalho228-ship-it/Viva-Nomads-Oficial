/*
  Achado 35 (frente erros/estados vazios): /admin/parceiros/pedidos não pode mostrar "Nenhum pedido ainda" e números
  zerados quando a leitura falha. O erro sobe e cai no error.tsx do admin ("Tentar de novo").
  Roda: node --test src/lib/admin/achado35-parceiros-pedidos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/admin/parceiros/pedidos/page.tsx", import.meta.url), "utf8");

test("as leituras de pedidos e parceiros guardam o erro e lançam antes da lista", () => {
  assert.match(page, /\[\{ data, error \}, testes, \{ data: parcs, error: erroParceiros \}\]/);
  const lanca = page.indexOf("if (error || erroParceiros) throw new Error");
  assert.ok(lanca > 0);
  assert.ok(lanca < page.indexOf("const pedidos = (data ?? [])"));
});
