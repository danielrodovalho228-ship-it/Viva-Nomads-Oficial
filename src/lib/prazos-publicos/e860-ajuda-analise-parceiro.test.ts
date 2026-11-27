import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ } from "../atendimento/faq.ts";
import { CADASTRO_PARCEIRO } from "../atendimento/parceiros-texto.ts";
import { TEXTO_PRAZO_PARCERIA } from "../../config/prazos-canais.ts";

/* E860: o artigo da Ajuda sobre a análise do parceiro declara o prazo canônico do canal parceiro (o de /parceiros). */
test("a resposta 'Como virar parceiro' traz o prazo do canal parceiro, igual a /parceiros", () => {
  assert.ok(CADASTRO_PARCEIRO.includes(TEXTO_PRAZO_PARCERIA), CADASTRO_PARCEIRO);
  const r = FAQ.find((p) => p.id === "como-virar-parceiro")!.resposta;
  assert.ok(r.includes(TEXTO_PRAZO_PARCERIA), r);
  assert.doesNotMatch(r, /dias úteis/);
});
