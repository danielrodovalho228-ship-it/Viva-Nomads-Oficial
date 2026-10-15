import assert from "node:assert/strict";
import test from "node:test";
import { abrirLinkEmNovaAba, type JanelaAba } from "./abrir-aba.ts";

function janela() {
  const j: JanelaAba & { fechada: boolean } = { opener: {}, location: { href: "about:blank" }, fechada: false, close() { this.fechada = true; } };
  return j;
}

test("abre a aba antes de buscar o link e depois navega sem opener", async () => {
  const j = janela();
  const ordem: string[] = [];
  const ok = await abrirLinkEmNovaAba(
    () => (ordem.push("abriu"), j),
    async () => (ordem.push("buscou"), "https://x.test/doc?token=1"),
  );
  assert.equal(ok, true);
  assert.deepEqual(ordem, ["abriu", "buscou"]);
  assert.equal(j.location.href, "https://x.test/doc?token=1");
  assert.equal(j.opener, null);
});

test("sem link, fecha a aba em branco e devolve false", async () => {
  const j = janela();
  assert.equal(await abrirLinkEmNovaAba(() => j, async () => null), false);
  assert.equal(j.fechada, true);
});

test("erro ao buscar o link também fecha a aba", async () => {
  const j = janela();
  assert.equal(await abrirLinkEmNovaAba(() => j, async () => { throw new Error("x"); }), false);
  assert.equal(j.fechada, true);
});
