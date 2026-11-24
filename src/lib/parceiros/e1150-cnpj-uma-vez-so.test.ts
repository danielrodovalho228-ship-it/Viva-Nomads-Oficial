/*
  E1150 (ORDEM-DUET-641; P1 da varredura da classe E1145): em /parceiros, com um CPF no campo do documento, a frase
  "A Viva só trabalha com parceiros que têm CNPJ…" aparecia DUAS vezes — na nota fixa acima do campo (sp-so-cnpj) e na
  recusa em vermelho logo abaixo (sp-erro-documento). Decisão do Gerente: sem frase nova; com o erro do documento
  activo, a nota fixa esconde-se e a recusa fica como a única instância. Sem erro, a nota aparece como antes.
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

test("E1150: a nota fixa (sp-so-cnpj) só aparece sem o erro do documento; a recusa junto do campo continua", () => {
  const i = FORM.indexOf('data-testid="sp-so-cnpj"');
  assert.ok(i > 0, "a nota continua a existir");
  const antes = FORM.slice(Math.max(0, i - 220), i);
  assert.match(antes, /\{campoErro !== "documento" && \(\s*<p className="rounded-lg bg-sage-100\/60 px-3 py-2 text-sm text-ink" $/);
  assert.match(FORM, /\{msgDoCampo\("documento"\)\}/);
});
