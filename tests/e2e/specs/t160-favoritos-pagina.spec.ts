import { test, expect } from "@playwright/test";

/**
 * T160 — /favoritos (ordem 56a3a15c, D16), pública, 390 e 1280 px, sem login.
 * Sem 404 e sem login: /favoritos abre vazia; E448: o coração do visitante leva à porta de login. O topo público (E176)
 * não tem link Favoritos.
 */
for (const largura of [390, 1280]) {
  test.describe(`T160 — Favoritos (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("E448: /favoritos abre sem login (vazio); o coração do visitante leva à porta de login", async ({ page }) => {
      const resp = await page.goto("/favoritos", { waitUntil: "networkidle" });
      expect(resp?.status()).toBe(200);
      await expect(page.getByTestId("favoritos-vazio")).toBeVisible();
      await expect(page.getByRole("link", { name: "Explorar imóveis" })).toHaveAttribute("href", "/buscar");

      await page.goto("/buscar", { waitUntil: "networkidle" });
      // O toque antes da hidratação é repetido até a navegação acontecer.
      await expect(async () => {
        if (new URL(page.url()).pathname !== "/auth") await page.getByRole("button", { name: "Adicionar aos favoritos" }).first().click({ timeout: 3_000 });
        await page.waitForURL((u) => u.pathname === "/auth", { timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      const u = new URL(page.url());
      expect(u.searchParams.get("motivo")).toBe("favorito");
      await expect(page.getByTestId("entrada-motivo")).toHaveText("Para guardar seus favoritos em qualquer aparelho, entre com seu e-mail.");
      // Nada guardado no aparelho sem conta.
      const locais = await page.evaluate(() => (JSON.parse(localStorage.getItem("vivanomads-favorites") ?? "{}").state?.ids ?? []) as string[]);
      expect(locais).toEqual([]);
    });

    test("o topo público não tem link Favoritos (E176, PUBLICO-A); a página abre pelo endereço, sem 404", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      // PUBLICO-A: o topo é Imóveis · Anunciar · Empresas; no celular os mesmos links ficam no menu do cabeçalho.
      if (largura === 390) await page.getByRole("button", { name: "Abrir menu" }).click();
      const lista = largura === 390 ? page.getByTestId("nav-menu-lista") : page.getByTestId("topo-publico").getByTestId("nav-links");
      await expect(lista.getByRole("link", { name: /Favoritos/ })).toHaveCount(0);
      const resp = await page.goto("/favoritos", { waitUntil: "networkidle" });
      expect(resp?.status()).toBe(200);
      await expect(page.getByTestId("favoritos")).toBeVisible();
    });
  });
}
