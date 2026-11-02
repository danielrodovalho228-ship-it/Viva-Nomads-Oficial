/*
  Resíduo da varredura de funções — quemEAPessoa (baixo): o painel "Quem é a pessoa" (Admin → Atendimento) lia o
  chamado, o perfil, os anúncios, os contratos, os pedidos e os chamados anteriores sem conferir o erro. Na falha, o
  painel mostrava uma pessoa SEM anúncios, SEM contratos ou "conta nova" — e a equipe respondia com base nisso. Agora
  qualquer leitura que falha devolve "tente de novo" em vez de um perfil incompleto; a falha do chamado não vira
  "Chamado não encontrado". O painel só lê (o registro da consulta segue igual).
  Roda: node --test src/lib/atendimento/residuo-quem-e-a-pessoa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../data/atendimento-actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function quemEAPessoa"), src.indexOf("\n}\n", src.indexOf("export async function quemEAPessoa")));

test("o chamado não lido não vira 'Chamado não encontrado'", () => {
  assert.match(fn, /const \{ data: c, error: erroChamado \} = await admin\.from\("chamados"\)/);
  assert.ok(fn.indexOf("if (erroChamado) return { ok: false, error: MSG_PESSOA_SEM_LEITURA };") < fn.indexOf('"Chamado não encontrado."'));
});

test("qualquer das seis leituras da pessoa que falha → 'tente de novo', nunca um perfil incompleto", () => {
  assert.match(fn, /const leituras = await Promise\.all\(\[/);
  assert.match(fn, /if \(leituras\.some\(\(l\) => l\.error\)\) return \{ ok: false, error: MSG_PESSOA_SEM_LEITURA \};/);
  assert.ok(fn.indexOf("leituras.some((l) => l.error)") < fn.indexOf("prontidaoDosImoveis("), "confere antes de montar o perfil");
});
