import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T79 — ordem 9f3085d8: menu do painel em CASCATA, conta única (decisão do Daniel, 14/10).
 *  • Todo usuário: Visão geral, Minha moradia, Mensagens, Ferramentas, Minha conta.
 *  • Quem já anunciou: + Meus imóveis e Contratos e garantias (no mesmo menu).
 *  • Quem nunca anunciou: botão "Anunciar meu imóvel" (abre o cadastro, sem cair fora).
 *  • Admin: grupo Administração separado, com subgrupos.
 *  • Grupo da tela atual abre sozinho; itens dentro de itens; vale no celular (gaveta).
 */
const menu = (page: Page) => page.locator("aside").first().getByTestId("menu-cascata");
const topo = (page: Page) =>
  menu(page).locator(":scope > li > a, :scope > li > button").allInnerTexts().then((t) => t.map((x) => x.trim()));

test.describe("T79 — dono (já anunciou)", () => {
  test.use({ storageState: authFile("proprietario") });

  test("grupos de dono no mesmo menu; grupo da tela atual abre sozinho", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect.poll(() => topo(page)).toEqual([
      "Visão geral",
      "Minha moradia",
      "Mensagens",
      "Meus imóveis",
      "Contratos e garantias",
      "Ferramentas",
      "Minha conta",
    ]);
    await expect(page.getByTestId("menu-anunciar")).toHaveCount(0);

    // Abre "Contratos e garantias": três itens dentro.
    const grupo = menu(page).getByRole("button", { name: "Contratos e garantias" });
    await expect(grupo).toHaveAttribute("aria-expanded", "false");
    await grupo.click();
    await expect(grupo).toHaveAttribute("aria-expanded", "true");
    for (const r of ["Contratos & blocos", "Caução e garantias", "Conferência de entrada"])
      await expect(menu(page).getByRole("link", { name: r })).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-dono-1440.png" });

    // Tela de dentro de um grupo: o grupo abre sozinho e marca o item.
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    await expect(menu(page).getByRole("button", { name: "Meus imóveis" })).toHaveAttribute("aria-expanded", "true");
    await expect(menu(page).getByRole("link", { name: "Anúncios" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("aside nav")).not.toContainText(/Administração|Moderar/);
  });

  test("Ferramentas: grupo próprio com as ferramentas do negócio", async ({ page }) => {
    await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
    const g = menu(page).getByRole("button", { name: "Ferramentas" });
    await expect(g).toHaveAttribute("aria-expanded", "true");
    for (const r of ["Todas as ferramentas", "Simulador de rentabilidade", "Calculadora de ROI", "Viabilidade", "Orçamentos"])
      await expect(menu(page).getByRole("link", { name: r })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Simulador de rentabilidade" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("T79 — quem nunca anunciou", () => {
  test.use({ storageState: authFile("inquilino") });

  test("sem seções de dono; 'Anunciar meu imóvel' abre o cadastro", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect.poll(() => topo(page)).toEqual(["Visão geral", "Minha moradia", "Mensagens", "Ferramentas", "Minha conta"]);
    await menu(page).getByRole("button", { name: "Minha moradia" }).click();
    for (const r of ["Buscar imóveis", "Favoritos & comparações", "Candidaturas", "Minhas estadias"])
      await expect(menu(page).getByRole("link", { name: r })).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-sem-imovel-1440.png" });

    await page.locator("aside").first().getByTestId("menu-anunciar").click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/, { timeout: 15_000 });
    await page.waitForTimeout(1500);
    await expect(page, "não volta para a Visão geral").toHaveURL(/\/dashboard\/imoveis\/novo/);
  });

  test("celular: a gaveta tem o mesmo menu em cascata", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const gaveta = page.locator("aside").filter({ has: page.getByTestId("menu-cascata") }).last();
    await expect(gaveta).toBeVisible();
    await gaveta.getByRole("button", { name: "Minha moradia" }).click();
    await expect(gaveta.getByRole("link", { name: "Minhas estadias" })).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-390.png" });
    await gaveta.getByRole("link", { name: "Minhas estadias" }).click();
    await expect(page).toHaveURL(/\/dashboard\/locacoes/);
  });
});

test.describe("T79 — admin", () => {
  test.use({ storageState: authFile("admin") });

  test("Administração separada, com subgrupos (itens dentro de itens)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/documentos", { waitUntil: "networkidle" });
    const adm = menu(page).getByRole("button", { name: "Administração" });
    await expect(adm).toHaveAttribute("aria-expanded", "true");
    await expect(menu(page).getByRole("button", { name: "Operação" })).toHaveAttribute("aria-expanded", "true");
    await expect(menu(page).getByRole("link", { name: "Documentos" })).toHaveAttribute("aria-current", "page");
    await menu(page).getByRole("button", { name: "Dinheiro" }).click();
    await expect(menu(page).getByRole("link", { name: "Caixa dos Sócios" })).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-admin-1440.png" });
  });
});
