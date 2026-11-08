import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { documentoDoParceiroAtivo } from "../documento-pessoa.ts";

test("E685: CNPJ aparece com o tipo e mascarado (raiz visível)", () => {
  assert.deepEqual(documentoDoParceiroAtivo("pj", "12345678000190"), { tipo: "CNPJ", texto: "12.345.678/****-**" });
  assert.deepEqual(documentoDoParceiroAtivo(null, "12.345.678/0001-90"), { tipo: "CNPJ", texto: "12.345.678/****-**" });
});

test("E685: CPF aparece com o tipo e mascarado", () => {
  assert.deepEqual(documentoDoParceiroAtivo("pf", "12345678901"), { tipo: "CPF", texto: "***.456.789-**" });
});

test("E685: sem documento ou com formato estranho, diz que não há e não inventa número", () => {
  assert.deepEqual(documentoDoParceiroAtivo("pj", null), { tipo: "CNPJ", texto: "não informado" });
  assert.deepEqual(documentoDoParceiroAtivo("pf", "123"), { tipo: "CPF", texto: "não informado" });
  assert.deepEqual(documentoDoParceiroAtivo(null, ""), { tipo: "Documento", texto: "não informado" });
});

test("E685: a aba Ativas lê o documento da solicitação ativada e a linha o mostra", () => {
  const pg = readFileSync("src/app/(dashboard)/admin/parceiros/page.tsx", "utf8");
  const fi = readFileSync("src/app/(dashboard)/admin/parceiros/fichas.tsx", "utf8");
  assert.match(pg, /documentoDoParceiroAtivo\(/);
  assert.match(pg, /from\("parceiro_solicitacoes"\)\.select\("user_id, tipo_pessoa, documento"\)/);
  assert.match(fi, /data-testid="linha-ativa-documento"/);
});
