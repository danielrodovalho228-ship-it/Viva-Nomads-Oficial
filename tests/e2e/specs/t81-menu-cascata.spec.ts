import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T81 — menus do painel. MENUS-5 (25/10) substituiu a cascata do usuário: fora do /admin, cada papel navega pelas
 * abas do topo (computador) e pela barra de baixo (celular), da mesma lista (config/abas-painel.ts), e a Conta abre no
 * avatar. A cascata continua só na barra da equipe (/admin), com subgrupos.
 */
const menu = (page: Page) => page.locator("aside").first().getByTestId("menu-cascata");

test.describe("T81 — dono (já anunciou)", () => {
  test.use({ storageState: authFile("proprietario") });

  test("abas do dono no topo; a aba e a subaba da tela atual acendem; sem barra lateral", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("abas-dono").locator("a")).toHaveText(["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"], { timeout: 30_000 });
    await expect(page.getByTestId("barra-lateral")).toHaveCount(0);
    await page.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aba-dono-contratos")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    await expect(page.getByTestId("subaba-dono-caucao")).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-dono-1440.png" });
  });

  test("Ferramentas: fora da Conta; o Início do dono leva a 'Todas as ferramentas'", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByTestId("conta-dono").click();
    await expect(page.getByTestId("menu-conta-dono")).not.toContainText("Ferramentas");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("inicio-dono-todas-ferramentas")).toHaveAttribute("href", "/dashboard/ferramentas");
  });
});

test.describe("T81 — quem nunca anunciou", () => {
  test.use({ storageState: authFile("inquilino") });

  test("só as abas do morador; nada do dono na Conta", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const abas = page.getByTestId("abas-morador").locator("a");
    await expect(abas.first()).toHaveText("Início", { timeout: 30_000 });
    for (const r of ["Anúncios", "Interessados", "Ferramentas"]) await expect(abas.filter({ hasText: r })).toHaveCount(0);
    await page.getByTestId("conta-morador").click();
    await expect(page.getByTestId("menu-conta-morador")).not.toContainText(/Ferramentas|Anunciar/);
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-sem-imovel-1440.png" });
  });

  test("celular: barra de baixo do morador e Conta no avatar (sem gaveta)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).locator("a").first()).toHaveText("Início", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveCount(0);
    await page.getByTestId("topo-celular").getByTestId("conta-morador-celular").click();
    await expect(page.getByTestId("menu-conta-morador-celular")).toContainText("Perfil e dados");
    await page.screenshot({ path: "tests/laboratorio/saida/t79-menu-390.png" });
  });
});

test.describe("T81 — admin", () => {
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
