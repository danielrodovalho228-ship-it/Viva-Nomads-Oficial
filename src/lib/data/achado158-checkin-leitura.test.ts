/*
  Auditoria de erros e estados vazios — achado 158. Instruções de entrada (check-in) do contrato: a falha ao LER o contrato ou as
  instruções virava "sem acesso" (null) ou "instruções ainda não preenchidas" — o dono achava que tinha de preencher de novo e o
  morador, que o dono não tinha mandado nada. Agora as duas leituras destrutam o `error` e a falha LANÇA (a página mostra "Tentar de
  novo"); a ação de salvar devolve uma mensagem clara em vez de estourar. Roda: node --test src/lib/data/achado158-checkin-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./checkin-actions.ts", import.meta.url), "utf8");
const i = src.indexOf("async function contexto(");
const corpo = src.slice(i, src.indexOf("\n/** Instruções de entrada", i));

test("contexto: a falha de leitura do contrato lança antes do 'sem acesso'", () => {
  assert.match(corpo, /const \{ data: c, error: erroContrato \} = await admin/);
  const lanca = corpo.indexOf("if (erroContrato) throw new Error(MSG_CHECKIN_SEM_LEITURA)");
  assert.ok(lanca > 0 && lanca < corpo.indexOf("if (!c) return null;"));
});

test("contexto: a falha de leitura das instruções lança (não vira 'não preenchidas')", () => {
  assert.match(corpo, /const \{ data: k, error: erroInstrucoes \} = await admin\.from\("contratos_checkin"\)/);
  assert.match(corpo, /if \(erroInstrucoes\) throw new Error\(MSG_CHECKIN_SEM_LEITURA\);/);
});

test("salvarInstrucoesEntrada: a leitura que falha vira mensagem, não exceção", () => {
  const j = src.indexOf("export async function salvarInstrucoesEntrada(");
  const fn = src.slice(j, j + 700);
  assert.match(fn, /catch/);
  assert.match(fn, /MSG_CHECKIN_SEM_LEITURA/);
});
