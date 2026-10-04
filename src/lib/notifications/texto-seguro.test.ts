/*
  Texto do usuário em e-mail oficial: sem HTML ativo e sem links.
  Roda: node --test src/lib/notifications/texto-seguro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { textoEmail, textoPlano, semLinks } from "./texto-seguro.ts";

test("link escondido em HTML vira texto, sem <a>", () => {
  const out = textoEmail(`Studio <a href="https://golpe.com/pix">clique aqui</a>`);
  assert.ok(!out.includes("<a"), out);
  assert.ok(!/golpe\.com/.test(out), out);
  assert.ok(out.includes("&lt;a href="), out);
});

test("endereços soltos são removidos", () => {
  for (const t of ["veja www.golpe.com.br", "acesse http://x.y/z", "pague em pix-agora.xyz/123", "site golpe.com"]) {
    assert.ok(semLinks(t).includes("[link removido]"), t);
    assert.ok(!/golpe|x\.y|pix-agora/.test(semLinks(t)), semLinks(t));
  }
});

test("texto comum e acentos passam, com limite de tamanho", () => {
  assert.equal(textoEmail("Apartamento no Santa Mônica, 2 quartos."), "Apartamento no Santa Mônica, 2 quartos.");
  assert.equal(textoPlano("a".repeat(10), 5), "aaaaa…");
});

test("valores com ponto não viram link removido", () => {
  assert.equal(semLinks("Aluguel R$ 3.500,00 por mês"), "Aluguel R$ 3.500,00 por mês");
});
