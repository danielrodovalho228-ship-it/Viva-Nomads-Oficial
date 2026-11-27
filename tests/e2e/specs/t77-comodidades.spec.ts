import { test, expect } from "@playwright/test";

/** T77 — Clareza UX3 (ordem ae570e76): 5 comodidades + "Ver todas" com a lista completa agrupada. */
for (const largura of [390, 1280]) {
  test.describe(`T77 — comodidades a ${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test("mostra no máximo 5 e 'Ver todas' abre a lista completa", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const bloco = page.getByTestId("comodidades");
      await expect(bloco).toBeVisible();
      // E744 (asserção alterada, tabela da Fable #3832): o "no máximo 5" (`:scope > ul > li`) passava vazio. Regra do
      // E191/E357: com "Tem × Não tem", o "Tem" é a lista COMPLETA, agrupada por categoria — o mesmo N do "Ver todas as N";
      // sem o "Não tem", só as principais (LIMITE_PRINCIPAIS = 6).
      const ver = page.getByTestId("comodidades-ver-todas");
      // ube-001 tem 18 comodidades: o botão é obrigatório (sem ele o teste não pode passar em branco).
      await expect(ver).toBeVisible();
      const total = Number((await ver.innerText()).match(/Ver todas as (\d+)/)?.[1]);
      expect(total).toBeGreaterThan(0);
      const itensTem = await bloco.getByTestId("comodidades-principais").locator("li").count();
      if ((await bloco.getByTestId("comodidades-nao-tem").count()) > 0) {
        expect(itensTem, "com Tem × Não tem, o Tem é a lista completa").toBe(total);
        await expect(bloco.getByTestId("comodidades-principais").getByTestId("comodidades-categoria").first()).toBeVisible();
      } else {
        expect(itensTem).toBeGreaterThan(0);
        expect(itensTem).toBeLessThanOrEqual(6);
      }
      await ver.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByTestId("comodidades-lista-completa").getByTestId("comodidades-categoria").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  });
}
