import { test, expect } from "@playwright/test";

/**
 * T16 — Boas-vindas do app com a foto no topo. Em 390×844 (iPhone 12/13/14) e
 * 375×667 (iPhone SE): a foto carrega colada no topo e os 3 botões + o aviso de
 * 2027 cabem na tela SEM rolar. A rota é a mesma no site (o proxy só redireciona
 * quem tem sessão dentro do app), então roda sem o user-agent do app.
 */
for (const [w, h] of [
  [390, 844],
  [375, 667],
] as const) {
  test.describe(`T16 — Boas-vindas ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, storageState: { cookies: [], origins: [] } });

    test("foto no topo e botões visíveis sem rolar", async ({ page }, info) => {
      test.skip(info.project.name !== "chromium", "roda uma vez, no projeto do site");
      await page.goto("/app/boas-vindas", { waitUntil: "networkidle" });
      test.skip(!/boas-vindas/.test(page.url()), "sessão ativa redirecionou");

      const foto = page.getByRole("img", { name: /Pessoa chegando com a mala/ });
      await expect(foto).toBeVisible();
      const carregou = await foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
      expect(carregou).toBe(true);
      expect((await foto.boundingBox())?.y ?? 99).toBeLessThanOrEqual(1);

      for (const nome of ["Quero alugar", "Quero anunciar", "Já tenho conta"]) {
        const caixa = await page.getByRole("link", { name: nome }).boundingBox();
        expect(caixa, nome).not.toBeNull();
        expect(caixa!.y + caixa!.height, `${nome} cabe na tela`).toBeLessThanOrEqual(h);
      }
      const aviso = await page.getByText("Lançamento oficial em 2027.").boundingBox();
      expect(aviso!.y + aviso!.height).toBeLessThanOrEqual(h);

      const rola = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
      expect(rola, "a tela não deve rolar").toBe(false);
    });
  });
}
