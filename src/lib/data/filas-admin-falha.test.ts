/*
  Auditoria de erros e estados vazios — achado nº 16: no admin, as filas de Documentos e de Matrículas mostravam "fila
  vazia" quando a leitura do banco falhava — a equipe perderia o prazo de 48 h achando que não havia nada. Agora a
  página pede as duas filas com `exigir`: a falha lança e o admin mostra "Não conseguimos abrir esta tela" com "Tentar de
  novo" (admin/error.tsx).
  Roda: node --test src/lib/data/filas-admin-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as duas filas lançam na falha do banco quando a página pede com exigir", () => {
  const docs = ler("src/lib/data/documentos-admin.ts");
  assert.match(docs, /export async function listDocumentosPendentes\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(docs, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_DOCUMENTOS_NAO_CARREGOU\);/);
  const mat = ler("src/lib/data/matriculas-admin.ts");
  assert.match(mat, /export async function listMatriculasFila\(limite = 40, opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(mat, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_MATRICULAS_NAO_CARREGOU\);/);
});

test("a página de documentos do admin pede com exigir e tem o limite de erro com 'Tentar de novo'", () => {
  const pg = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(pg, /listDocumentosPendentes\(\{ exigir: true \}\)/);
  assert.match(pg, /listMatriculasFila\(undefined, \{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/admin/error.tsx"), /Tentar de novo/);
});
