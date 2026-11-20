import { test, expect } from "@playwright/test";

/*
  T1457 — C10 (#3341) e C7 (#3350), na main; jornadas apontadas pela Pista QA. Visitante, sem estouro horizontal.
    1. C10: /seguranca tem, depois dos golpes, a faixa "Desconfie de quem pede pagamento fora da plataforma" com o botão
       "Fale com a Viva" que leva ao atendimento (/ajuda/fale-com-a-viva). 390 e 1280 px.
    2. C7: em /para-proprietarios a 390 × 844, o botão "Anunciar meu imóvel" do banner fica na primeira tela (inteiro dentro
       do viewport) e NADA o cobre (a navegação de baixo não está na frente do centro do botão); a frase da taxa vem depois dele.
*/
test.describe("T1457 — C10 /seguranca avise a Viva; C7 botão na dobra", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const w of [1280, 390] as const) {
    test(`C10 a ${w} px: faixa "Desconfie…" com o botão Fale com a Viva`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto("/seguranca", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const faixa = page.getByTestId("seguranca-avise");
      await expect(faixa).toBeVisible({ timeout: 30_000 });
      await expect(faixa).toContainText("Desconfie de quem pede pagamento fora da plataforma");
      const botao = page.getByTestId("seguranca-fale-com-a-viva");
      await expect(botao).toHaveText("Fale com a Viva");
      expect(await botao.getAttribute("href")).toMatch(/\/ajuda\/fale-com-a-viva/);
      await botao.scrollIntoViewIfNeeded();
      const caixa = await botao.boundingBox();
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(w);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }

  test("C7 a 390 × 844: o botão Anunciar meu imóvel está na dobra e livre; a frase da taxa vem depois", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.goto("/para-proprietarios", { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    const botao = page.getByRole("link", { name: /Anunciar meu imóvel/i }).filter({ visible: true }).first();
    await expect(botao).toBeVisible({ timeout: 30_000 });
    const caixa = await botao.boundingBox();
    expect(caixa!.y, "o botão começa dentro da primeira tela").toBeGreaterThanOrEqual(0);
    expect(caixa!.y + caixa!.height, "o botão termina dentro da primeira tela (844)").toBeLessThanOrEqual(844);
    // Nada na frente do centro do botão (a navegação de baixo não pode cobri-lo).
    const livre = await botao.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!topo && (el === topo || el.contains(topo));
    });
    expect(livre, "o centro do botão não está coberto por outro elemento").toBe(true);
    const taxa = page.getByTestId("anunciar-taxa");
    await expect(taxa).toContainText("Anuncie de graça.");
    const caixaTaxa = await taxa.boundingBox();
    expect(caixaTaxa!.y, "a frase da taxa vem depois do botão").toBeGreaterThan(caixa!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});
