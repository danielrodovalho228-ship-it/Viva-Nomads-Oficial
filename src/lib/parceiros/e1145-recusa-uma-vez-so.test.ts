/*
  E1145 (ORDEM-DUET-632; achado da perna 1 da passagem, 23/11, perna-01-recusa-1920.pdf): em /parceiros, a recusa do
  pedido de parceria aparecia DUAS vezes na mesma tela — junto do campo que a causou (certo, padrão E818) e outra vez
  no aviso geral, abaixo da linha "Regra 90/10" (a cópia). Agora o erro com campo aparece só junto do campo; o aviso
  geral fica para o erro que não tem campo (sessão não confirmada, falha do envio).
  Roda: node --test src/lib/parceiros/e1145-recusa-uma-vez-so.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTATO_AVISO } from "../pedidos/pedidos.ts";
import { validarSolicitacao } from "./regras.ts";

const FORM = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");
const base = { nome: "Ana Limpezas", tipoPessoa: "pj" as const, documento: "11.222.333/0001-81", categorias: ["limpeza"], cidades: ["Uberlândia"], aceite: true, descricao: "Limpeza residencial", emiteNota: true };

test("E1145: a recusa de contacto tem campo — é a mensagem junto do campo que a mostra", () => {
  assert.deepEqual(validarSolicitacao({ ...base, descricao: "Chama no zap 34 99876-5432" }), { ok: false, erro: CONTATO_AVISO, campo: "descricao" });
  assert.deepEqual(validarSolicitacao({ ...base, nome: "Ana 34 99999-1234" }), { ok: false, erro: CONTATO_AVISO, campo: "nome" });
  // A mensagem junto do campo continua (padrão E818).
  assert.match(FORM, /campoErro === k && erro \? \(\s*<p id="sp-erro-campo"[^>]*data-testid=\{`sp-erro-\$\{k\}`\}>\s*\{erro\}/);
});

test("E1145: o aviso geral (abaixo da Regra 90/10) só aparece para o erro SEM campo — nunca repete a mensagem do campo", () => {
  const i = FORM.indexOf('data-testid="seja-parceiro-erro"');
  assert.ok(i > 0, "o aviso geral continua a existir para os erros sem campo");
  const antes = FORM.slice(Math.max(0, i - 200), i);
  assert.match(antes, /\{erro && !campoErro && \(\s*<p className="text-sm text-red-700" role="alert" $/);
  // Os erros sem campo continuam a chegar ao aviso geral.
  assert.match(FORM, /return falhar\(ERRO_SESSAO_NAO_CONFIRMADA\);/);
});
