import { test, expect } from "@playwright/test";

/**
 * T160 — /favoritos (ordem 56a3a15c, D16), pública, 390 e 1280 px, sem login.
 * Favoritar 2 → /favoritos mostra 2 → desfavoritar 1 → mostra 1; sem 404; link "Favoritos" no cabeçalho/aba.
 */
for (const largura of [390, 1280]) {
  test.describe(`T160 — Favoritos (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("favoritar 2, ver na página, desfavoritar 1", async ({ page, request }) => {
      const resp = await page.goto("/favoritos", { waitUntil: "networkidle" });
      expect(resp?.status()).toBe(200);
      await expect(page.getByTestId("favoritos-vazio")).toBeVisible();
      await expect(page.getByRole("link", { name: "Explorar imóveis" })).toHaveAttribute("href", "/buscar");

      await page.goto("/buscar", { waitUntil: "networkidle" });
      const coracoes = page.getByRole("button", { name: "Adicionar aos favoritos" });
      const removers = page.getByRole("button", { name: "Remover dos favoritos" });
      // Espera cada clique virar "Remover" antes do próximo; o toque antes da hidratação é repetido.
      for (const esperado of [1, 2]) {
        await expect(async () => {
          if ((await removers.count()) < esperado) await coracoes.nth(0).click();
          await expect(removers).toHaveCount(esperado, { timeout: 3_000 });
        }).toPass({ timeout: 30_000 });
      }

      await page.goto("/favoritos", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Favoritos (2)" })).toBeVisible();
      await expect(page.getByTestId("favoritos-grade")).toHaveAttribute("aria-busy", "false");
      await expect(page.getByTestId("favoritos-grade").locator("article, a[href^='/imoveis/']").first()).toBeVisible();
      // O título conta os favoritos guardados; a grade só mostra os que ainda estão no ar. Outro spec do lab pode
      // apagar ou pausar um anúncio entre o coração e esta tela (lab 75f265dd: 1 de 2): confere pelo que a API devolve.
      const noAr = async () => {
        const guardados: string[] = await page.evaluate(() => JSON.parse(localStorage.getItem("vivanomads-favorites") ?? "{}").state?.ids ?? []);
        const api = (await (await request.get("/api/properties")).json()) as unknown;
        const lista = (Array.isArray(api) ? api : ((api as { properties?: unknown[] }).properties ?? [])) as { id: string }[];
        return guardados.filter((id) => lista.some((p) => p.id === id)).length;
      };
      const antes = await noAr();
      expect(antes).toBeGreaterThanOrEqual(1);
      await expect(page.getByRole("button", { name: "Remover dos favoritos" })).toHaveCount(antes);

      await page.getByRole("button", { name: "Remover dos favoritos" }).first().click();
      await expect(page.getByRole("heading", { name: "Favoritos (1)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Remover dos favoritos" })).toHaveCount(await noAr());
    });

    test("link Favoritos aparece e leva à página (sem 404)", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      if (largura === 390) {
        // No celular a aba/menu: abre o menu do cabeçalho se a aba inferior não existir.
        const aba = page.getByRole("link", { name: /Favoritos/ }).first();
        if (!(await aba.isVisible())) await page.getByRole("button", { name: "Abrir menu" }).click();
      }
      const link = page.getByRole("link", { name: /Favoritos/ }).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/favoritos$/);
      await expect(page.getByTestId("favoritos")).toBeVisible();
    });
  });
}
