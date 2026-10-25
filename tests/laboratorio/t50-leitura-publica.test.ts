import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Toda tabela que uma migração abre para o papel anon por uma policy *_le_publico precisa estar em
// LEITURA_PUBLICA do t50; senão o laboratório acusa "anon leu linha" numa leitura que é de propósito
// (t50, lab de 22/10: parceiro_galeria).
test("t50: tabelas de parceiro com policy _le_publico estão em LEITURA_PUBLICA", () => {
  const spec = readFileSync("tests/e2e/specs/t50-rls-todas-tabelas.spec.ts", "utf8");
  const lista = spec.match(/LEITURA_PUBLICA = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const migracao = readFileSync("supabase/migrations/0190_parceiros_ciclo.sql", "utf8");
  const tabelas = migracao.match(/foreach t in array array\[([^\]]+)\]/i)?.[1].match(/parceiro_[a-z_]+/g) ?? [];
  assert.ok(tabelas.length >= 3, "a migração 0190 abre as tabelas de parceiro para anon");
  for (const t of tabelas) assert.ok(lista.includes(`"${t}"`), `${t} falta em LEITURA_PUBLICA`);
});
