// E764: o estado vazio de Mensagens não pode dizer que telefone e e-mail "aparecem depois do aceite": pelo E445 o contato nunca é trocado
// no chat e segue mascarado em qualquer fase (emergência = telefone da Viva).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_MENSAGENS_VAZIO, TITULO_MENSAGENS_VAZIO } from "./mensagens-vazio.ts";

test("E764: o texto diz a regra certa — contato nunca trocado, protegido em qualquer fase, inclusive depois do aceite", () => {
  assert.match(TEXTO_MENSAGENS_VAZIO, /nunca são trocados/);
  assert.match(TEXTO_MENSAGENS_VAZIO, /contato protegido/);
  assert.match(TEXTO_MENSAGENS_VAZIO, /inclusive depois do aceite/);
  assert.match(TEXTO_MENSAGENS_VAZIO, /emergência.*telefone da Viva/);
});

test("E764: nenhuma frase promete contato liberado depois do aceite", () => {
  assert.doesNotMatch(TEXTO_MENSAGENS_VAZIO, /só aparecem depois do aceite/);
  assert.equal(TITULO_MENSAGENS_VAZIO, "Nenhuma conversa ainda");
});

test("E764: a tela de Mensagens usa o texto único (e não o antigo)", () => {
  const t = readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8");
  assert.match(t, /\{TEXTO_MENSAGENS_VAZIO\}/);
  assert.doesNotMatch(t, /só aparecem depois do aceite/);
});
