/*
  Auditoria de erros e estados vazios — achado 156. Proposta (`/dashboard/propostas/[id]`): a falha ao LER a proposta virava
  null e a página respondia 404 ("não encontrada") — a pessoa achava que a proposta tinha sumido. Agora a leitura destrutura o
  `error` e a falha LANÇA (a página mostra o error.tsx com "Tentar de novo"), como nos achados 108–113.
  Roda: node --test src/lib/data/achado156-proposta-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./propostas-actions.ts", import.meta.url), "utf8");
const i = src.indexOf("export async function lerProposta(");
const corpo = src.slice(i, src.indexOf("\nexport ", i + 10));

test("lerProposta: a falha de leitura da proposta lança, antes do 'não existe'", () => {
  const leitura = corpo.indexOf('const { data: pRow, error: erroProposta } = await s.supabase.from("propostas")');
  assert.ok(leitura >= 0, "destrutura o error da leitura da proposta");
  const lanca = corpo.indexOf("if (erroProposta) throw new Error(");
  const naoAchou = corpo.indexOf("if (!p) return null;");
  assert.ok(lanca > leitura && lanca < naoAchou, "o erro vem ANTES do 'null' (404)");
});
