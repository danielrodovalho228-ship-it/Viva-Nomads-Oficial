/*
  Estados vazios — Conta › Meus dados: a leitura da data de nascimento que falha não vira campo vazio.
  Antes, getNascimento ignorava o erro e devolvia "", a tela engolia a falha, e salvar o nome/telefone mandava ""
  para salvarNascimento — que grava null e APAGAVA a data já salva. Agora a leitura lança; a tela trava o campo
  e salvar os dados não mexe na data.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_NASCIMENTO_FALHOU, validarNascimento } from "../conta/nascimento.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("o perigo: data vazia é válida e vira null ao salvar", () => {
  assert.deepEqual(validarNascimento(""), { ok: true, iso: null });
});

test("getNascimento lança quando a leitura falha", () => {
  const src = ler("./nascimento-actions.ts");
  const i = src.indexOf("export async function getNascimento(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /const \{ data, error \} = await supabase\.from\("profiles"\)\.select\("data_nascimento"\)/);
  assert.match(f, /if \(error\) throw new Error\(/);
});

test("a tela trava o campo e salvar não chama salvarNascimento quando a data não carregou", () => {
  const tela = ler("../../components/account/conta-secoes.tsx");
  assert.match(tela, /getNascimento\(\)\s*\.then\(\(n\) => vivo && setNascimento\(\(atual\) => nascimentoAoCarregar\(atual, n\)\)\)\s*\.catch\(\(\) => vivo && setNascFalhou\(true\)\)/);
  assert.match(tela, /nascFalhou\s*\? Promise\.resolve\(\{ ok: true, error: undefined \}\)\s*: salvarNascimento\(nascimento\)/);
  assert.match(tela, /const nasc = nascFalhou \? \(\{ ok: true \} as const\) : validarNascimento\(nascimento\);/);
  assert.match(tela, /disabled=\{nascFalhou\}/);
  assert.ok(AVISO_NASCIMENTO_FALHOU.length > 0);
});
