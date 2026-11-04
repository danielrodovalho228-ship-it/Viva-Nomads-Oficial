/* Roda: node --test src/lib/manutencao/e485-botao-desligado.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_BOTAO_SEM_CONTRATO } from "../manutencao-solicitacoes.ts";

/*
  E485 — simulação do chamado de manutenção (02/11): o botão "Abrir solicitação" nascia desligado sem explicação.
  O motivo vai junto do próprio botão: uma linha visível logo abaixo dele e o aria-describedby apontando para ela
  (leitor de tela). O aviso completo com a Central de Ajuda continua no painel.
*/
const pagina = readFileSync("src/app/(dashboard)/dashboard/solicitacoes/page.tsx", "utf8");

test("o texto curto do motivo existe e fala do contrato ativo", () => {
  assert.match(MSG_BOTAO_SEM_CONTRATO, /contrato ativo/);
  assert.ok(MSG_BOTAO_SEM_CONTRATO.length <= 60);
});

test("o botão desligado aponta para o motivo (aria-describedby) e o motivo aparece ao lado dele", () => {
  assert.match(pagina, /aria-describedby=\{semContrato \? "abrir-solicitacao-motivo" : undefined\}/);
  assert.match(pagina, /id="abrir-solicitacao-motivo"/);
  assert.match(pagina, /data-testid="abrir-solicitacao-motivo"/);
  assert.match(pagina, /\{MSG_BOTAO_SEM_CONTRATO\}/);
});

test("o aviso completo do painel continua (Central de Ajuda)", () => {
  assert.match(pagina, /data-testid="manutencao-sem-contrato"/);
  assert.match(pagina, /\{MSG_SEM_CONTRATO_MANUTENCAO\}/);
});
