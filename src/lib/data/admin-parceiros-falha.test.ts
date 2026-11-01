/*
  Auditoria de erros e estados vazios — achado nº 18: em /admin/parceiros, a falha do banco nas filas (pedidos, contagem
  das abas e parceiros ativos) virava "Nada pendente" e abas zeradas — a equipe perderia o pedido de parceria. Agora a
  página LANÇA na falha e o admin mostra "Não conseguimos abrir esta tela" com "Tentar de novo". A Central de
  Pendências já dizia "Não foi possível ler as pendências agora" (fica como está).
  Roda: node --test src/lib/data/admin-parceiros-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("admin/parceiros lança na falha das filas (nunca 'Nada pendente' calado)", () => {
  const pg = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.match(pg, /if \(\[sols, contagem, parceiros\]\.some\(\(r\) => \(r as \{ error\?: unknown \}\)\.error\)\) throw new Error\(/);
  assert.match(ler("src/app/(dashboard)/admin/error.tsx"), /Tentar de novo/);
});

test("a Central de Pendências segue avisando a falha na própria tela", () => {
  const pg = ler("src/app/(dashboard)/admin/pendencias/page.tsx");
  assert.match(pg, /centralDePendencias\(admin, agora, filtro\)\.catch\(\(\) => null\)/);
  assert.match(pg, /Não foi possível ler as pendências agora/);
});
