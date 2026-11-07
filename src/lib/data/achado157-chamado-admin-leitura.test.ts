/*
  Auditoria de erros e estados vazios — achado 157. Admin › Atendimento › chamado (`/admin/atendimento/[id]`): a falha ao LER o
  chamado virava null e a página respondia 404 ("não encontrado"). Agora a leitura destrutura o `error` e a falha LANÇA (error.tsx
  com "Tentar de novo"). Roda: node --test src/lib/data/achado157-chamado-admin-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./atendimento-actions.ts", import.meta.url), "utf8");
const i = src.indexOf("export async function chamadoAdmin(");
const corpo = src.slice(i, src.indexOf("\nexport ", i + 10));

test("chamadoAdmin: a falha de leitura do chamado lança, antes do 'não existe'", () => {
  const leitura = corpo.indexOf('const { data: c, error: erroChamado } = await ctx.admin.from("chamados")');
  assert.ok(leitura >= 0, "destrutura o error da leitura do chamado");
  const lanca = corpo.indexOf("if (erroChamado) throw new Error(");
  const naoAchou = corpo.indexOf("if (!c) return null;");
  assert.ok(lanca > leitura && lanca < naoAchou, "o erro vem ANTES do 'null' (404)");
});
