import { test, expect } from "@playwright/test";

/**
 * T191 — ordem 65e999b2 (Próximo do FF 4/6, "Publicamos para você"): rota da fila fechada para quem não é admin
 * e sem rolagem lateral no celular. O fluxo logado (pedir → fila do /admin → andamento no painel) roda com as
 * contas de QA do laboratório (t169): E2E pendente: roda no laboratório após o merge.
 */
test("visitante não entra na fila de ajuda do /admin", async ({ page }) => {
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/admin\/ajuda-publicacao$/);
});

test("390 px: /auth sem rolagem lateral (a rota privada redireciona)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(sem).toBe(true);
});
