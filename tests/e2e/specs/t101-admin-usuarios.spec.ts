import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T101 — Admin: o cartão "Usuários" abre a lista (ordem 61454243). A lista não mostra CPF, telefone nem e-mail,
 * o filtro Fundadores funciona e não há rolagem lateral a 360/1280 px.
 */
test.describe("T101 — Admin: lista de usuários", () => {
  test.use({ storageState: authFile("admin") });

  test("cartão Usuários leva a /admin/usuarios", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.locator('main a[href="/admin/usuarios"]').first().click();
    await expect(page).toHaveURL(/\/admin\/usuarios$/);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  });

  for (const largura of [360, 1280]) {
    test(`lista sem dado sensível e sem rolagem lateral a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-usuarios-lista")).toBeVisible();
      const corpo = page.locator("main");
      await expect(corpo).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}|@[a-z0-9-]+\.[a-z]{2,}|\(\d{2}\) ?\d{4,5}-?\d{4}/i);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
    });
  }

  test("filtro inválido na URL é ignorado (sem erro)", async ({ page }) => {
    const r = await page.goto("/admin/usuarios?papel=admin&desde=ontem&fundador=1", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  });

  // Moacir (#584): o total da lista tem de bater com o número do cartão que a abre.
  for (const [rotulo, rota] of [
    ["Usuários", "/admin/usuarios"],
    ["Fundadores", "/admin/usuarios?fundador=1"],
  ] as const) {
    test(`total da lista = número do cartão ${rotulo}`, async ({ page }) => {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const cartao = page.locator(`main a[href="${rota}"]`).first();
      await expect(cartao).toBeVisible();
      const doCartao = Number(((await cartao.innerText()).match(/\d[\d.]*/g) ?? []).pop()?.replace(/\./g, ""));
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const titulo = await page.getByTestId("admin-usuarios-lista").getByRole("heading").first().innerText();
      expect(Number(titulo.match(/\(([\d.]+)\)/)?.[1].replace(/\./g, ""))).toBe(doCartao);
    });
  }

  test("busca por nome e filtro de cadastro respondem sem erro e mostram a coluna Cadastro completo", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const r = await page.goto("/admin/usuarios?cadastro=incompleto&q=a", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByTestId("admin-usuarios-lista")).toBeVisible();
    await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    if ((await page.locator("[data-usuario]").count()) > 0) {
      await expect(page.getByRole("columnheader", { name: "Cadastro completo" })).toBeVisible();
    }
  });
});
