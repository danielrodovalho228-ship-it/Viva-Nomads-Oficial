/*
  Ordem 90181c57 (#93): sem mensalidade — /dashboard/assinatura redireciona a /precos.
  Roda: node --test src/lib/planos/assinatura-redireciona.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/(dashboard)/dashboard/assinatura/page.tsx", import.meta.url), "utf8");

test("a tela antiga de assinatura só redireciona a /precos", () => {
  assert.match(page, /redirect\("\/precos"\)/);
  assert.doesNotMatch(page, /"use client"/);
});

test("a tela não oferece mais plano pago nem cobrança", () => {
  for (const ruim of [/PLANS/, /Quero este plano/, /CREDIT_CARD/, /\/api\/assinatura/, /Assinar/]) {
    assert.doesNotMatch(page, ruim);
  }
});

test("o redirecionamento é HTTP (next.config), não um redirect() dentro do painel em streaming", () => {
  const config = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /source:\s*"\/dashboard\/assinatura"[^}]*destination:\s*"\/precos"/);
});
