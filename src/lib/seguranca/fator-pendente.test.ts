import test from "node:test";
import assert from "node:assert/strict";
import { gravarPendente, lerPendente, limparPendente, type FatorPendente } from "./fator-pendente.ts";

function memoria() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const P: FatorPendente = { factorId: "f1", qr: "data:image/svg+xml;utf8,<svg/>", segredo: "ABCDEF" };

test("recarregar a tela com o mesmo fator não verificado devolve o MESMO QR/chave", () => {
  const st = memoria();
  gravarPendente(st, P);
  assert.deepEqual(lerPendente(st, ["f1"]), P);
  assert.deepEqual(lerPendente(st, ["f1"]), P); // segunda abertura: igual
});

test("se o fator não existe mais (ou já foi verificado), o QR guardado não é reaproveitado", () => {
  const st = memoria();
  gravarPendente(st, P);
  assert.equal(lerPendente(st, []), null);
  assert.equal(lerPendente(st, ["outro"]), null);
});

test("limpar e dado corrompido/sem armazenamento não quebram", () => {
  const st = memoria();
  gravarPendente(st, P);
  limparPendente(st);
  assert.equal(lerPendente(st, ["f1"]), null);
  st.setItem("vn:2fa-pendente", "{nao-json");
  assert.equal(lerPendente(st, ["f1"]), null);
  assert.equal(lerPendente(null, ["f1"]), null);
  gravarPendente(null, P);
});
