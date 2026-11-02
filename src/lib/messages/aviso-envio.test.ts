/** E445 item 2 — aviso ANTES de enviar quando o texto tem contato/link/documento — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoAntesDeEnviar } from "./aviso-envio.ts";

const MASK = "[contato protegido]";

test("texto sem contato: segue direto, sem aviso", () => {
  assert.equal(avisoAntesDeEnviar("A entrada é a partir das 14h.").tipo, "livre");
});

test("telefone e e-mail: pede confirmação e mostra a prévia mascarada (a mesma que o servidor grava)", () => {
  const r = avisoAntesDeEnviar("Me chama no (34) 99999-8888 ou em dora@exemplo.com");
  assert.equal(r.tipo, "confirmar");
  assert.ok(r.tipo === "confirmar" && r.previa.includes(MASK));
  assert.ok(r.tipo === "confirmar" && !/99999|dora@/.test(r.previa));
});

test("link de mensageiro / rede social: pede confirmação", () => {
  for (const t of ["fala comigo em wa.me/5534999998888", "me segue instagram.com/dora.prado", "insta @dora.prado"]) {
    const r = avisoAntesDeEnviar(t);
    assert.equal(r.tipo, "confirmar", t);
  }
});

test("documento (CPF/RG): continua bloqueado — contato nunca é liberado e documento não vai pelo chat", () => {
  assert.equal(avisoAntesDeEnviar("meu CPF é 529.982.247-25").tipo, "documento");
});

test("a prévia é sempre o texto mascarado, nunca o original", () => {
  const original = "liga 11 98888-7777";
  const r = avisoAntesDeEnviar(original);
  assert.ok(r.tipo === "confirmar" && r.previa !== original);
});
