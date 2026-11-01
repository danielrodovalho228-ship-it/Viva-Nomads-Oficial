/*
  Achado 36 (frente erros/estados vazios): /admin/usuarios não pode mostrar "Nenhum usuário nesta lista" quando a
  leitura de profiles falha. O erro sobe e cai no error.tsx do admin ("Tentar de novo").
  Roda: node --test src/lib/admin/achado36-usuarios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/admin/usuarios/page.tsx", import.meta.url), "utf8");

test("a leitura da lista guarda o erro e lança antes de montar as linhas", () => {
  assert.match(page, /\[\{ data, error: erroLista \}, confirmados, comAnuncio\]/);
  const lanca = page.indexOf("if (erroLista) throw new Error");
  assert.ok(lanca > 0);
  assert.ok(lanca < page.indexOf("let todas = ((data ?? [])"));
});
