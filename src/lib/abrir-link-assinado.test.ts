import test from "node:test";
import assert from "node:assert/strict";
import { abrirLinkAssinado, type JanelaAberta } from "./abrir-link-assinado.ts";

function aba(): JanelaAberta & { fechada: boolean } {
  const a = { opener: "pai" as unknown, location: { href: "" }, fechada: false, close() { a.fechada = true; } };
  return a;
}

test("abre a aba antes de buscar o link e depois navega para ele, sem opener", async () => {
  const a = aba();
  const ordem: string[] = [];
  const r = await abrirLinkAssinado(
    () => (ordem.push("abrir"), a),
    async () => (ordem.push("buscar"), { ok: true, url: "https://x/sign?token=1" }),
  );
  assert.deepEqual(ordem, ["abrir", "buscar"]);
  assert.equal(r.ok, true);
  assert.equal(a.location.href, "https://x/sign?token=1");
  assert.equal(a.opener, null);
  assert.equal(a.fechada, false);
});

test("se o servidor recusar, fecha a aba em branco e devolve o erro", async () => {
  const a = aba();
  const r = await abrirLinkAssinado(() => a, async () => ({ ok: false, error: "Sem permissão." }));
  assert.deepEqual(r, { ok: false, error: "Sem permissão." });
  assert.equal(a.fechada, true);
  assert.equal(a.location.href, "");
});

test("falha de rede: mensagem padrão e aba fechada", async () => {
  const a = aba();
  const r = await abrirLinkAssinado(() => a, () => Promise.reject(new Error("rede")));
  assert.deepEqual(r, { ok: false, error: "Não foi possível abrir agora." });
  assert.equal(a.fechada, true);
});

test("pop-up bloqueado: avisa em vez de falhar em silêncio", async () => {
  const r = await abrirLinkAssinado(() => null, async () => ({ ok: true, url: "https://x" }));
  assert.equal(r.ok, false);
});
