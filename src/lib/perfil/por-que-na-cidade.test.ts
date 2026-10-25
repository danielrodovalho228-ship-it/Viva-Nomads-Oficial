/*
  Ordem 9950ef15, item 3: cartão "Por que estou na cidade".
  Roda: node --test src/lib/perfil/por-que-na-cidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarPorQueNaCidade, FRASE_MAX, EMPRESA_MAX } from "./por-que-na-cidade.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("tudo vazio é válido (nada é obrigatório)", () => {
  const r = validarPorQueNaCidade({});
  assert.deepEqual(r, { ok: true, valor: { inicio: null, fim: null, empresa: null, frase: null } });
});

test("período, empresa e frase válidos passam, com espaços normalizados", () => {
  const r = validarPorQueNaCidade({ inicio: "2026-11-01", fim: "2027-02-01", empresa: "  Hospital   das Clínicas ", frase: "Residência médica" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.empresa, "Hospital das Clínicas");
});

test("saída antes da chegada e data impossível são recusadas", () => {
  assert.equal(validarPorQueNaCidade({ inicio: "2026-11-10", fim: "2026-11-01" }).ok, false);
  assert.equal(validarPorQueNaCidade({ inicio: "2026-02-30" }).ok, false);
  assert.equal(validarPorQueNaCidade({ fim: "amanhã" }).ok, false);
});

test("contato no texto livre é recusado; limite de tamanho vale", () => {
  assert.equal(validarPorQueNaCidade({ frase: "me chame no (34) 99999-0000" }).ok, false);
  assert.equal(validarPorQueNaCidade({ empresa: "fulano@empresa.com" }).ok, false);
  assert.equal(validarPorQueNaCidade({ frase: "a".repeat(FRASE_MAX + 1) }).ok, false);
  assert.equal(validarPorQueNaCidade({ empresa: "a".repeat(EMPRESA_MAX + 1) }).ok, false);
});

test("o servidor valida e grava só na própria linha; a migração tem rollback e registro", () => {
  const a = ler("src/lib/data/perfil-actions.ts");
  assert.match(a, /validarPorQueNaCidade/);
  assert.match(a, /\.eq\("id", user\.id\)/);
  assert.match(ler("supabase/producao/aplicar-0249.sql"), /20261025000249/);
  assert.match(ler("supabase/producao/rollback/0249_rollback.sql"), /drop column if exists cidade_frase/);
});
