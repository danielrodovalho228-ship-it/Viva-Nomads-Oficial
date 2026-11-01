/*
  Achado 31 (frente erros/estados vazios): /admin/contratos não pode mostrar "Nenhum contrato nesta lista" e totais
  zerados quando a leitura dos contratos falha. A lista principal lê com `exigir`; o erro cai no error.tsx do admin.
  Roda: node --test src/lib/admin/achado31-contratos-exigir.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/admin/contratos/page.tsx", import.meta.url), "utf8");

test("a lista principal de contratos lê com exigir", () => {
  assert.match(page, /contratosReais\(admin, p \? intervaloBRT\(p\.inicio, p\.fim\) : undefined, cidade, tipo, \{ exigir: true \}\)/);
  assert.doesNotMatch(page, /contratosReais\([^)]*\)\.catch/);
});

test("o admin tem o aviso de erro com 'Tentar de novo'", () => {
  const erro = new URL("../../app/(dashboard)/admin/error.tsx", import.meta.url);
  assert.ok(existsSync(erro));
  assert.match(readFileSync(erro, "utf8"), /Tentar de novo/);
});

test("contratosReais lança com exigir", () => {
  const s = readFileSync(new URL("../data/admin-indicadores.ts", import.meta.url), "utf8");
  assert.match(s, /if \(error && opcoes\.exigir\) throw new Error\("Não foi possível ler os contratos\."\)/);
});
