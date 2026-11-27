import { test } from "node:test";
import assert from "node:assert/strict";
import { fonte } from "./ler.ts";

/* E878: o cadastro de parceiro promete, ANTES de enviar (junto do botão), o prazo canônico do canal parceiro e o que vem
   depois (o link para ativar a página) — sem mexer na lista de documentos. */
const form = fonte("src/components/parceiros/seja-parceiro-form.tsx");

test("junto do botão de enviar, o prazo do canal parceiro pela fonte única", () => {
  const i = form.indexOf('data-testid="seja-parceiro-prazo"');
  assert.ok(i > 0, "linha do prazo no formulário");
  assert.ok(i < form.indexOf('data-testid="seja-parceiro-enviar"'), "antes do botão Enviar");
  assert.match(form.slice(i, i + 300), /\{TEXTO_PRAZO_PARCERIA\}/);
});
