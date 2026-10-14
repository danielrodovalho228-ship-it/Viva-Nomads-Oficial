import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm } from "../fixtures/laboratorio";

/**
 * T71 — ordem d15ef6bf: topo da /buscar no padrão Airbnb/Furnished Finder.
 *  1. Cabeçalho limpo na /buscar (sem os links do meio): logo + ações.
 *  2. Barra de filtros no topo, CENTRALIZADA e em destaque; título fixo abaixo.
 *  3. Contagem "N imóveis em <cidade>" + "Salvar busca" (coração) ao lado.
 *  4. Visitante que toca em Salvar busca vai para o login e volta para a busca.
 *  5. Logado: salva, aparece em Buscas salvas, e o coração remove.
 *  6. Celular e 1024 px adaptam sem rolagem lateral.
 */
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T71 — topo da /buscar", () => {
  test("1–3. computador: topo limpo, filtros centralizados, título e contagem + Salvar busca", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    const header = page.locator("header").first();
    await expect(header.getByTestId("nav-links")).toBeHidden();
    await expect(header.getByRole("link", { name: "Para empresas" })).toBeHidden();
    await expect(header.getByRole("link", { name: "Entrar para anunciar" })).toBeVisible();

    const caixa = (await page.getByTestId("filtros-caixa").boundingBox())!;
    expect(Math.abs(caixa.x + caixa.width / 2 - 720), "barra centralizada").toBeLessThanOrEqual(24);
    expect(caixa.height, "barra numa linha").toBeLessThanOrEqual(64);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("Imóveis mobiliados para sua estadia");
    const h1Box = (await h1.boundingBox())!;
    expect(h1Box.y, "título abaixo da barra").toBeGreaterThan(caixa.y + caixa.height);

    const total = page.getByTestId("total-resultados");
    await expect(total).toHaveText(/^\d+ imóve(l|is) em Uberlândia$/);
    const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
    await expect(salvar).toHaveText(/Salvar busca/);
    const tBox = (await total.boundingBox())!;
    const sBox = (await salvar.boundingBox())!;
    expect(Math.abs(sBox.y + sBox.height / 2 - (tBox.y + tBox.height / 2)), "Salvar busca ao lado da contagem").toBeLessThanOrEqual(12);
    expect(tBox.y).toBeGreaterThan(h1Box.y);
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-topo-1440.png" });

    // Outras páginas mantêm a navegação.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("header").first().getByTestId("nav-links")).toBeVisible();
  });

  test("4. visitante: Salvar busca leva ao login e volta para a mesma busca", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
    await page.getByTestId("salvar-busca").filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/auth\?redirect=%2Fbuscar%3F.*local%3DUberl/);
  });

  test.describe("logado", () => {
    test.use({ storageState: authFile("inquilino") });
    test("5. salva, aparece em Buscas salvas e o coração remove", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
      const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });
      await expect(salvar).toHaveAttribute("aria-pressed", "true");
      const { data } = await adm().from("buscas_salvas").select("parametros, resumo").ilike("parametros", "%pronto=1%");
      expect((data ?? []).some((r) => r.resumo.includes("Uberlândia") && r.resumo.includes("Pronto para Morar"))).toBe(true);

      await page.goto("/dashboard/buscas", { waitUntil: "networkidle" });
      await expect(page.getByTestId("buscas-salvas")).toContainText("Uberlândia · Pronto para Morar");

      await page.goto("/buscar?local=Uberl%C3%A2ndia&pronto=1", { waitUntil: "networkidle" });
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
    });
  });

  test("6. celular 390 px e 1024 px adaptam sem quebrar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca-celular")).toBeVisible();
    await expect(page.getByTestId("total-celular")).toContainText("em Uberlândia");
    await expect(page.getByTestId("salvar-busca").filter({ visible: true })).toBeVisible();
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t71-topo-390.png" });

    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/buscar", { waitUntil: "networkidle" });
    await expect(page.locator("header").first().getByTestId("nav-acoes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
  });
});
