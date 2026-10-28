/*
  Ordem 286312f8 (P3): medir interesse em espaço de trabalho, sem construir o produto.
  Roda: node --test src/lib/perfil/espaco-trabalho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarEspacoTrabalho, contarInteresse, OFERTA, PROCURA } from "./espaco-trabalho.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("tudo vazio é válido (as duas perguntas são opcionais)", () => {
  assert.deepEqual(validarEspacoTrabalho({}), { ok: true, valor: { oferta: null, procura: null } });
});

test("respostas conhecidas passam", () => {
  const r = validarEspacoTrabalho({ oferta: "consultorio", procura: "sala_consultorio" });
  assert.deepEqual(r, { ok: true, valor: { oferta: "consultorio", procura: "sala_consultorio" } });
});

test("'não' é uma resposta (diferente de não responder)", () => {
  const r = validarEspacoTrabalho({ oferta: "nao", procura: "nao" });
  assert.deepEqual(r, { ok: true, valor: { oferta: "nao", procura: "nao" } });
});

test("valor fora da lista é recusado no servidor", () => {
  assert.equal(validarEspacoTrabalho({ oferta: "hotel" }).ok, false);
  assert.equal(validarEspacoTrabalho({ procura: "x'; drop table profiles;--" }).ok, false);
});

test("as listas casam com os check da migração", () => {
  const sql = ler("supabase/migrations/0250_espaco_trabalho_interesse.sql");
  for (const v of [...OFERTA, ...PROCURA]) assert.ok(sql.includes(`'${v}'`), v);
});

test("contagem: só quem disse sim, contas de teste à parte", () => {
  const linhas = [
    { oferta: "sala", procura: null, teste: false },
    { oferta: "nao", procura: "nao", teste: false },
    { oferta: "clinica", procura: "coworking", teste: false },
    { oferta: null, procura: "sala_consultorio", teste: true },
    { oferta: null, procura: null, teste: false },
  ];
  assert.deepEqual(contarInteresse(linhas), {
    oferecem: { reais: 2, teste: 0 },
    procuram: { reais: 1, teste: 1 },
    coworking: { reais: 1, teste: 0 },
    responderam: { reais: 3, teste: 1 },
  });
});

test("a migração libera só as duas colunas para o próprio usuário, com rollback", () => {
  const sql = ler("supabase/migrations/0250_espaco_trabalho_interesse.sql");
  assert.match(sql, /grant update \(espaco_trabalho_oferta, espaco_trabalho_procura\)/);
  assert.ok(ler("supabase/producao/aplicar-0250.sql").includes("20261028000250"));
  assert.ok(ler("supabase/producao/rollback/0250_rollback.sql").includes("drop column if exists espaco_trabalho_oferta"));
});
