/*
  E361 — a porta da QA (/qa/entrar) diz a causa em vez do genérico "Não foi possível entrar.":
   - 429: o limite real (30 por hora, por aparelho ou por conta) e o prazo (até 1 hora);
   - 503: a conferência do limite falhou (tente de novo);
   - 404: as causas possíveis, sem dizer qual. A rota segue com o MESMO corpo em todo 404 (t596, caso 2): quem tem a
     chave vazada não descobre se um e-mail tem conta. O motivo exato fica no log do servidor (qa_porta_recusa).
  Roda: node --test src/lib/qa/e361-mensagens.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mensagemPortaQa } from "./mensagens-porta.ts";
import { LIMITE_QA_POR_HORA } from "./entrar.ts";

test("cada causa tem a sua mensagem; nenhuma é o genérico de antes", () => {
  const limite = mensagemPortaQa(429);
  assert.match(limite, new RegExp(`${LIMITE_QA_POR_HORA} entradas por hora`));
  assert.match(limite, /até 1 hora/);
  assert.match(mensagemPortaQa(503), /Tente de novo/);
  // E488: o 404 é a chave que não confere; as outras causas vêm no 403, cada uma com a sua frase (e488-causa-recusa).
  assert.match(mensagemPortaQa(404), /chave não confere/);
  assert.match(mensagemPortaQa(null), /conexão/i);
  const todas = [429, 503, 404, null].map((s) => mensagemPortaQa(s));
  assert.equal(new Set(todas).size, todas.length, "mensagens distintas");
  for (const m of todas) assert.notEqual(m, "Não foi possível entrar.");
});

test("o formulário usa as mensagens; a rota segue com o mesmo corpo em todo 404", () => {
  const form = readFileSync(new URL("../../app/qa/entrar/qa-entrar-form.tsx", import.meta.url), "utf8");
  assert.match(form, /setErro\(mensagemPortaQa\(r \? r\.status : null, corpo\?\.motivo\)\)/);
  assert.doesNotMatch(form, /"Não foi possível entrar\."/);
  const rota = readFileSync(new URL("../../app/api/qa/entrar/route.ts", import.meta.url), "utf8");
  // E488: chave errada/porta desligada seguem o 404 de sempre; com a chave certa, 403 com a causa.
  assert.match(rota, /if \(r\.status === 404\) return r\.motivo === "chave" \|\| r\.motivo === "desligada" \? naoEncontrado\(\) : recusada\(r\.motivo\);/);
});
