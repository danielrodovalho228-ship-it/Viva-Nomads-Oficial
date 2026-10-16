import { test, expect } from "@playwright/test";

/**
 * T137 — Comodidades "Tem / Não tem" (ordem 7000fbe0, tela 4): blocos lado a lado no
 * computador e empilhados no celular, ícone por item, nota de pergunta ao proprietário.
 * O "Não tem" só lista itens esperados que não estão marcados no cadastro.
 */
for (const largura of [390, 1280]) {
  test(`T137 — /imoveis/ube-001 mostra Tem / Não tem a ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const tem = page.getByTestId("comodidades-tem");
    await tem.scrollIntoViewIfNeeded();
    await expect(tem).toBeVisible();
    const nao = page.getByTestId("comodidades-nao-tem");
    if ((await nao.count()) > 0) {
      await expect(nao).toContainText("Precisa de algo da lista? Pergunte ao proprietário antes de pedir.");
      expect(await nao.locator("li svg").count()).toBeGreaterThan(0);
      const a = await tem.boundingBox();
      const b = await nao.boundingBox();
      if (largura >= 1024) expect(Math.abs((a?.y ?? 0) - (b?.y ?? 99))).toBeLessThan(40);
      else expect((b?.y ?? 0)).toBeGreaterThan((a?.y ?? 0));
    }
    await expect(page.getByTestId("comodidades-ver-todas")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
