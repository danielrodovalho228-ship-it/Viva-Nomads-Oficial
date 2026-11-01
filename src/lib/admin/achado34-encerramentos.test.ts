/*
  Achado 34 (frente erros/estados vazios): /admin/contratos/encerramentos não pode dizer "0 em aberto" e
  "Nada pendente" quando a leitura dos pedidos falha. O erro sobe e cai no error.tsx do admin ("Tentar de novo").
  Roda: node --test src/lib/admin/achado34-encerramentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/admin/contratos/encerramentos/page.tsx", import.meta.url), "utf8");

test("a leitura da fila guarda o erro e lança antes de montar a lista", () => {
  assert.match(page, /const \{ data, error \} = await admin\s*\.from\("contrato_encerramento_pedidos"\)/);
  const lanca = page.indexOf("if (error) throw new Error");
  assert.ok(lanca > 0);
  assert.ok(lanca < page.indexOf("const linhas = (data ?? [])"), "lança antes de virar lista vazia");
});
