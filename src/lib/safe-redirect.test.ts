/*
  A7 — destino de redirecionamento só interno.
  Roda: node --test src/lib/safe-redirect.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { safeInternalPath } from "./safe-redirect.ts";

/** Como o valor chega no código: decodificado da query (?redirect=… / ?next=…). */
const daQuery = (cru: string) => new URLSearchParams(`x=${cru}`).get("x");

test("caminhos internos passam (com query e hash)", () => {
  assert.equal(safeInternalPath("/dashboard"), "/dashboard");
  assert.equal(safeInternalPath("/imovel/abc?de=1#fotos"), "/imovel/abc?de=1#fotos");
  assert.equal(safeInternalPath(daQuery("%2Fdashboard%2Fmensagens")), "/dashboard/mensagens");
});

test("vazio/nulo → fallback", () => {
  assert.equal(safeInternalPath(null), "/dashboard");
  assert.equal(safeInternalPath(""), "/dashboard");
  assert.equal(safeInternalPath(undefined, "/"), "/");
});

const ATAQUES: [string, string | null][] = [
  ["%2F%2Fevil.com", daQuery("%2F%2Fevil.com")],
  ["/%2F%2Fevil.com", daQuery("/%2F%2Fevil.com")],
  ["//evil.com", "//evil.com"],
  ["/\\evil.com", "/\\evil.com"],
  ["/%5Cevil.com", daQuery("/%5Cevil.com")],
  ["/%09/evil.com (tab)", daQuery("/%09/evil.com")],
  ["/%0A/evil.com (LF)", daQuery("/%0A/evil.com")],
  ["/%0D/evil.com (CR)", daQuery("/%0D/evil.com")],
  ["@evil.com", daQuery("@evil.com")],
  [".evil.com", daQuery(".evil.com")],
  ["https://evil.com", daQuery("https://evil.com")],
  ["https%3A%2F%2Fevil.com", daQuery("https%3A%2F%2Fevil.com")],
  ["javascript:alert(1)", daQuery("javascript:alert(1)")],
  ["  /espaço-antes", "  /dashboard"],
];
for (const [nome, valor] of ATAQUES) {
  test(`recusa ${nome}`, () => {
    assert.equal(safeInternalPath(valor), "/dashboard");
  });
}

test("rotas do servidor: new URL(destino, origin) nunca sai da origem", () => {
  const origin = "https://vivanomads.com.br";
  for (const [, valor] of ATAQUES) {
    assert.equal(new URL(safeInternalPath(valor), origin).origin, origin);
  }
  // O jeito antigo (concatenar) saía: `${origin}@evil.com` → host evil.com.
  assert.equal(new URL(`${origin}@evil.com`).host, "evil.com");
});
