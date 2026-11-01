/*
  Auditoria de erros e estados vazios — achado nº 14: na página da Estadia, uma falha na leitura do contrato virava
  "Contrato não encontrado" e a página caía em 404 ("não encontrada") — o morador e o dono achariam que o contrato
  sumiu. Agora a falha do banco é marcada (`falhou`) e carregarEstadia LANÇA: o painel mostra "Não conseguimos abrir
  esta tela" com "Tentar de novo". O 404 fica só para o contrato que de fato não existe ou não é da pessoa.
  Roda: node --test src/lib/data/estadia-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./estadia.ts", import.meta.url), "utf8");

test("a falha do banco na leitura do contrato não vira 'não encontrado'", () => {
  assert.match(src, /const \{ data, error \} = await admin\.from\("contratos"\)\.select\(COLUNAS_ESTADIA\)/);
  assert.match(src, /if \(error\) return \{ erro: MSG_ESTADIA_NAO_CARREGOU, falhou: true \};/);
  // O "não encontrado" de verdade continua (sem linha ou sem papel).
  assert.match(src, /if \(!c\) return \{ erro: "Contrato não encontrado\." \};/);
});

test("carregarEstadia lança na falha (limite de erro do painel), e só devolve null no 'não encontrado'", () => {
  const fn = src.slice(src.indexOf("export async function carregarEstadia"));
  assert.match(fn, /if \("erro" in ctx && ctx\.falhou\) throw new Error\(MSG_ESTADIA_NAO_CARREGOU\);\n\s*if \("erro" in ctx\) return null;/);
});
