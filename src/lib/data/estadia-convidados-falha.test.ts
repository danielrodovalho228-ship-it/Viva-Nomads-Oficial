/*
  Estados vazios (convidados da estadia): convidadosAtivos devolvia [] quando a leitura falhava.
   1. na página da estadia, o morador via "nenhum convidado" (e a vaga toda livre) mesmo tendo convidado alguém;
   2. ao convidar, a conferência do teto e do e-mail repetido corria com a lista vazia.
  Agora a falha devolve null: a página esconde o bloco (como antes da 0225, sem mostrar lista falsa) e o convite pede
  para tentar de novo, sem gravar nada.
  Roda: node --test src/lib/data/estadia-convidados-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leitura = readFileSync("src/lib/data/estadia-convidados.ts", "utf8");
const acoes = readFileSync("src/lib/data/estadia-convidados-actions.ts", "utf8");
const ativos = leitura.slice(leitura.indexOf("export async function convidadosAtivos"), leitura.indexOf("/** A lista do morador"));
const convidar = acoes.slice(acoes.indexOf("export async function convidarOcupante"), acoes.indexOf("const alvo = email.trim()"));

test("a falha da leitura devolve null, nunca a lista vazia", () => {
  assert.match(ativos, /Promise<ConvidadoView\[\] \| null>/);
  assert.match(ativos, /if \(error \|\| !data\) return null;/);
});

test("convidar: sem a lista, pede para tentar de novo antes de conferir o teto", () => {
  assert.match(convidar, /if \(!ativos\) return \{ ok: false, erro: MSG_CONVIDADOS_SEM_LEITURA \};/);
  assert.ok(convidar.indexOf("if (!ativos)") < convidar.indexOf("podeConvidar("), "confere antes do teto");
  assert.match(acoes, /const MSG_CONVIDADOS_SEM_LEITURA = "Não foi possível conferir os convidados agora\. Tente de novo\.";/);
});
