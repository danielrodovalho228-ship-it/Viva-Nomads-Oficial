import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoPedidoEncerrado } from "../../src/lib/notifications/corpo-e267-residual.ts";

/* t232 (lab 31/10, 3 labs seguidos): a spec esperava o assunto antigo "foi encerrado"; o E267 passou a citar a cidade. */
const spec = readFileSync("tests/e2e/specs/t232-pedido-moradia-completo.spec.ts", "utf8");
const m = spec.match(/const ASSUNTO_ENCERRADO = (\/.*\/);/);

test("a spec do t232 reconhece o assunto real do e-mail de pedido encerrado", () => {
  assert.ok(m, "ASSUNTO_ENCERRADO não encontrado na spec");
  const re = new RegExp(m![1].slice(1, -1));
  const assunto = corpoPedidoEncerrado({ cidade: "Uberlândia", imovel: null as never }).subject;
  assert.ok(assunto);
  assert.match(assunto!, re);
});
