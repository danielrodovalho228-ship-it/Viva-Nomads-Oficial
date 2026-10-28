/*
  CSP: sem 'unsafe-eval' em produção (ordem d2463a31); mantém frame-ancestors, Turnstile e Mapbox.
  Roda: node --test src/lib/seguranca/csp.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";

async function csp(ambiente: string): Promise<string> {
  const antes = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = ambiente;
  try {
    const { default: cfg } = await import(`../../../next.config.ts?amb=${ambiente}`);
    const regras = await cfg.headers!();
    const h = regras[0].headers.find((x: { key: string }) => x.key === "Content-Security-Policy-Report-Only");
    return h.value as string;
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = antes;
  }
}

test("produção não permite unsafe-eval", async () => {
  assert.ok(!(await csp("production")).includes("unsafe-eval"));
});

test("desenvolvimento ainda permite unsafe-eval (hot reload)", async () => {
  assert.ok((await csp("development")).includes("'unsafe-eval'"));
});

test("produção mantém frame-ancestors, Turnstile, Mapbox e worker blob", async () => {
  const c = await csp("production");
  for (const parte of [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "https://api.mapbox.com",
    "worker-src 'self' blob:",
  ]) {
    assert.ok(c.includes(parte), parte);
  }
});
