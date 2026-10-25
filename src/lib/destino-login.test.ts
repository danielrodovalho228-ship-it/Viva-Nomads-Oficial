/*
  F11 — o login devolve a pessoa ao destino COM a query.
  Roda: node --test src/lib/destino-login.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { destinoAposLogin, destinoQualificarSemImovel } from "./destino-login.ts";
import { safeInternalPath } from "./safe-redirect.ts";

const ID = "3f2b8c1e-1a2b-4c3d-9e8f-001122334455";

test("guarda a query do destino (?imovel=…)", () => {
  assert.equal(destinoAposLogin("/qualificar", `?imovel=${ID}`), `/qualificar?imovel=${ID}`);
  assert.equal(destinoAposLogin("/admin/socios", "?aba=caixa&p=2"), "/admin/socios?aba=caixa&p=2");
  assert.equal(destinoAposLogin("/dashboard", ""), "/dashboard");
});

test("o valor sobrevive à ida e volta pelo /auth?redirect=", () => {
  const u = new URL("https://x.test/auth");
  u.searchParams.set("redirect", destinoAposLogin("/qualificar", `?imovel=${ID}`));
  assert.equal(safeInternalPath(u.searchParams.get("redirect")), `/qualificar?imovel=${ID}`);
});

test("negativo: destino externo/estranho nunca vira redirect aberto", () => {
  assert.equal(destinoAposLogin("//evil.com", ""), "/dashboard");
  assert.equal(destinoAposLogin("/dashboard", "?x=\n//evil.com"), "/dashboard");
});

test("/qualificar sem imóvel: sempre o cadastro novo (E132-A; ele oferece retomar o rascunho)", () => {
  assert.equal(destinoQualificarSemImovel(), "/dashboard/imoveis/novo");
});
