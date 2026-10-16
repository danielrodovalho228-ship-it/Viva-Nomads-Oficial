import { test, expect } from "@playwright/test";

/*
  Ordem d250ea2f (item 5) — o cron das automações de e-mail nunca roda sem o segredo:
  sem cabeçalho ou com segredo errado não envia nada (401; 503 se o ambiente não tem CRON_SECRET).
*/
test("cron de automações recusa chamada sem segredo", async ({ request }) => {
  const r = await request.get("/api/cron/automacoes");
  expect([401, 503]).toContain(r.status());
  expect(await r.text()).not.toMatch(/enviados/);
});

test("cron de automações recusa segredo errado, inclusive no modo simulado", async ({ request }) => {
  const r = await request.get("/api/cron/automacoes?simular=1", { headers: { authorization: "Bearer segredo-errado" } });
  expect([401, 503]).toContain(r.status());
});
