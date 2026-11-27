/*
  E1150 (ORDEM-DUET-641; P1 da varredura da classe E1145): em /parceiros, com um CPF no campo do documento, a frase
  "A Viva só trabalha com parceiros que têm CNPJ…" aparecia DUAS vezes — na nota fixa acima do campo (sp-so-cnpj) e na
  recusa em vermelho logo abaixo (sp-erro-documento). Decisão do Gerente (ORDEM-641/642): sem frase nova; a nota fixa
  esconde-se se e só se a recusa activa do documento for a própria regra (MSG_SO_CNPJ) — outro erro do documento tem
  frase própria e a nota fica. Sem erro, a nota aparece como antes.
  Roda: node --test src/lib/parceiros/e1150-cnpj-uma-vez-so.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_SO_CNPJ, validarDocumentoParceiro } from "./regras.ts";

const FORM = readFileSync("src/components/parceiros/seja-parceiro-form.tsx", "utf8");

test("E1150: o CPF é recusado com a MESMA frase da nota fixa (é por isso que ela aparecia duas vezes)", () => {
  assert.equal(validarDocumentoParceiro("529.982.247-25"), MSG_SO_CNPJ);
  assert.match(FORM, /if \(erroDoc\) return falhar\(erroDoc, "documento"\);/);
});

test("E1150: a nota fixa (sp-so-cnpj) esconde-se só quando a recusa do documento é a própria regra; a recusa continua", () => {
  const i = FORM.indexOf('data-testid="sp-so-cnpj"');
  assert.ok(i > 0, "a nota continua a existir");
  const antes = FORM.slice(Math.max(0, i - 220), i);
  assert.match(antes, /\{!\(campoErro === "documento" && erro === MSG_SO_CNPJ\) && \(\s*<p className="rounded-lg bg-sage-100\/60 px-3 py-2 text-sm text-ink" $/);
  // Outro erro do documento tem frase própria (não repete a regra): a nota fica.
  assert.notEqual(validarDocumentoParceiro("11.222.333/0001-82"), MSG_SO_CNPJ);
  assert.notEqual(validarDocumentoParceiro(""), MSG_SO_CNPJ);
  assert.match(FORM, /\{msgDoCampo\("documento"\)\}/);
});
