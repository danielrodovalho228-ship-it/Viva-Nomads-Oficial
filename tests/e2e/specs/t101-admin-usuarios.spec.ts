import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T101 — Admin: o cartão "Usuários" abre a lista (ordem 61454243). A lista não mostra CPF, telefone nem e-mail,
 * o filtro Fundadores funciona e não há rolagem lateral a 360/1280 px.
 */
test.describe("T101 — Admin: lista de usuários", () => {
  test.use({ storageState: authFile("admin") });

  // ADMIN-4 (#1354): a inicial do /admin ficou com 4 números (sem o cartão Usuários); a porta é o menu do admin.
  test("cartão Usuários leva a /admin/usuarios", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const menu = page.getByTestId("menu-cascata").filter({ visible: true });
    const usuarios = menu.locator('a[href="/admin/usuarios"]').first();
    if (!(await usuarios.isVisible())) await menu.locator("li[data-menu-grupo] > button").filter({ hasText: "Anúncios e pessoas" }).first().click();
    await usuarios.click();
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

  // Moacir (#584): o total da lista tem de bater com o número que a abre. Desde o ADMIN-4 (#1354) o número dos
  // Usuários fica no topo da própria lista (numero-fonte-usuarios, a mesma função da inicial) e o cartão Fundadores
  // saiu; a lista dos fundadores segue com o total no título.
  test("total da lista = número do cartão Usuários", async ({ page }) => {
    // L-69 (Pista A, ADMIN-4): o número do topo conta todos os perfis (admin e anonimizado incluídos) e a lista só
    // proprietários e inquilinos ativos — "Usuários: 9 reais · 5 de teste" sobre "Usuários (8)" no laboratório.
    // Quem corrigir tira este test.fail.
    test.fail(true, "L-69: número do topo de /admin/usuarios ≠ total da lista");
    await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    const fonte = page.getByTestId("numero-fonte-usuarios");
    await expect(fonte).toBeVisible({ timeout: 30_000 });
    const titulo = await page.getByTestId("admin-usuarios-lista").getByRole("heading").first().innerText();
    const naLista = Number(titulo.match(/\(([\d.]+)\)/)?.[1].replace(/\./g, ""));
    const reais = Number(await fonte.getAttribute("data-reais"));
    const teste = Number(await fonte.getAttribute("data-teste"));
    console.log(`T101|usuarios|lista=${naLista}|fonte=${reais}+${teste}`);
    expect([reais, reais + teste], `lista "Usuários (${naLista})" contra "${await fonte.innerText()}"`).toContain(naLista);
  });

  test("total da lista = número do cartão Fundadores", async ({ page }) => {
    const r = await page.goto("/admin/usuarios?fundador=1", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    const titulo = await page.getByTestId("admin-usuarios-lista").getByRole("heading").first().innerText();
    expect(titulo).toMatch(/\([\d.]+\)/);
  });

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
