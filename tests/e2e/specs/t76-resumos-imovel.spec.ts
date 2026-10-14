import { test, expect } from "@playwright/test";

/**
 * T76 — Clareza UX2 (ordem 0cc4b050): resumos na página do imóvel.
 * "Sobre" com Mostrar mais, bloco "Bom saber" com 3 linhas e destaques só com dado.
 */
for (const largura of [390, 1280]) {
  test.describe(`T76 — resumos do imóvel a ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("Bom saber: 3 linhas, cada uma abre e fecha o detalhe", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const bloco = page.getByTestId("bom-saber");
      await expect(bloco).toBeVisible();
      for (const chave of ["cancelamento", "regras", "seguranca"]) {
        await page.getByTestId(`bom-saber-${chave}`).click();
        const janela = page.getByRole("dialog");
        await expect(janela).toBeVisible();
        await page.getByRole("button", { name: "Fechar" }).click();
        await expect(janela).toHaveCount(0);
      }
    });

    test("Sobre o imóvel: Mostrar mais (quando longo) abre o texto completo; sem rolagem lateral", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const sobre = page.getByTestId("sobre-imovel");
      await expect(sobre).toBeVisible();
      const mais = sobre.getByRole("button", { name: "Mostrar mais" });
      if (await mais.count()) {
        await mais.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      const estoura = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(estoura).toBe(false);
    });

    test("destaques: no máximo 3 e nenhum vazio", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const itens = page.getByTestId("destaques-imovel").locator("li");
      const n = await itens.count();
      expect(n).toBeLessThanOrEqual(3);
      for (let i = 0; i < n; i++) expect((await itens.nth(i).innerText()).trim().length).toBeGreaterThan(0);
    });
  });
}
