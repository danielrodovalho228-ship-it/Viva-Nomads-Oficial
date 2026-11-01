/*
  Auditoria de erros e estados vazios — achado nº 3: em Interessados, "Aprovar" e "Recusar" chamavam a ação do
  servidor dentro de startTransition sem try. Sem conexão a promessa rejeitava: a tela inteira caía no limite de erro
  ("Não conseguimos abrir esta tela"), o cartão ficava no estado otimista e a recusa não dizia nada.
  Roda: node --test src/lib/interessados/erros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SEM_CONEXAO, textoDoErro } from "../erro-de-rede.ts";
import { MSG_APROVAR_FALHOU, MSG_RECUSAR_FALHOU } from "./erros.ts";

const tela = readFileSync(new URL("../../app/(dashboard)/dashboard/leads/leads-client.tsx", import.meta.url), "utf8");
const corpo = (nome: string) => {
  const i = tela.indexOf(`function ${nome}(`);
  assert.ok(i > 0, nome);
  return tela.slice(i, tela.indexOf("\n  }\n", i));
};

test("sem conexão: aprovar e recusar mostram a frase em português (computador e celular), nunca o texto cru", () => {
  for (const cru of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."]) {
    assert.equal(textoDoErro(new TypeError(cru), MSG_APROVAR_FALHOU), MSG_SEM_CONEXAO, cru);
    assert.equal(textoDoErro(new TypeError(cru), MSG_RECUSAR_FALHOU), MSG_SEM_CONEXAO, cru);
  }
  // Outro erro técnico: a frase da própria ação.
  assert.equal(textoDoErro(new SyntaxError("Unexpected token"), MSG_APROVAR_FALHOU), MSG_APROVAR_FALHOU);
  assert.equal(textoDoErro(new SyntaxError("Unexpected token"), MSG_RECUSAR_FALHOU), MSG_RECUSAR_FALHOU);
  assert.equal(MSG_APROVAR_FALHOU, "Não foi possível aprovar agora. Tente de novo.");
  assert.equal(MSG_RECUSAR_FALHOU, "Não foi possível recusar agora. Tente de novo.");
});

test("aprovar: a ação fica dentro de try; na queda, o cartão volta a 'open' e o aviso diz a frase", () => {
  const a = corpo("aprovar");
  assert.match(a, /try \{\n\s*r = await aceitarCandidatura\(id\);\n\s*\} catch \(e\) \{\n\s*set\(id, "open"\);\n\s*setErro\(textoDoErro\(e, MSG_APROVAR_FALHOU\)\);\n\s*return;/);
  // A recusa do servidor (motivo em português, ex.: documento pendente) continua aparecendo como antes.
  assert.match(a, /setErro\(r\.error \?\? MSG_APROVAR_FALHOU\);/);
});

test("recusar: a ação fica dentro de try; na queda ou na recusa do servidor, volta ao motivo e DIZ por quê", () => {
  const r = corpo("recusar");
  assert.match(r, /try \{\n\s*r = await recusarCandidatura\(id, motivo\);\n\s*\} catch \(e\) \{\n\s*set\(id, "rejecting"\);\n\s*setErro\(textoDoErro\(e, MSG_RECUSAR_FALHOU\)\);\n\s*return;/);
  assert.match(r, /if \(!r\.ok\) \{\n\s*set\(id, "rejecting"\);\n\s*setErro\(r\.error \?\? MSG_RECUSAR_FALHOU\);\n\s*\} else setErro\(null\);/);
});

test("nenhuma ação da tela fica sem tratamento dentro da transição", () => {
  for (const m of tela.matchAll(/startTransition\(async \(\) => \{([\s\S]*?)\n\s{4}\}\);/g)) {
    if (/await /.test(m[1])) assert.match(m[1], /try \{/, "toda chamada ao servidor dentro de try");
  }
});
