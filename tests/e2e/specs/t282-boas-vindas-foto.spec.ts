import { test, expect } from "@playwright/test";

/*
  T282 — Boas-vindas do app (correção do Daniel, 22/10), a 390, 375×667 (iPhone SE) e 1280 px:
   1. a foto aparece inteira: nenhum elemento branco/translúcido por cima dela e o texto começa abaixo dela;
   2. a logo fica fora da foto, com 16–24 px de margem e alinhada à margem do título;
   3. textos e botões de sempre, e os botões cabem sem rolar (como no t16).
*/
const SAIDA = "tests/laboratorio/saida";

for (const [w, h] of [
  [390, 844],
  [375, 667],
  [1280, 900],
] as const) {
  test.describe(`T282 — ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, storageState: { cookies: [], origins: [] } });

    test("foto inteira sem véu, logo com respiro e alinhada ao texto", async ({ page }, info) => {
      test.skip(info.project.name !== "chromium", "roda uma vez, no projeto do site");
      await page.goto("/app/boas-vindas", { waitUntil: "networkidle" });
      test.skip(!/boas-vindas/.test(page.url()), "sessão ativa redirecionou");

      const caixaFoto = (await page.getByTestId("boas-vindas-foto").boundingBox())!;
      // Nada pintado por cima da foto além da própria imagem.
      const cobre = await page.getByTestId("boas-vindas-foto").evaluate((el) =>
        [...el.querySelectorAll<HTMLElement>("*")].filter((n) => n.tagName !== "IMG" && getComputedStyle(n).backgroundColor !== "rgba(0, 0, 0, 0)").length,
      );
      expect(cobre, "sem véu sobre a foto").toBe(0);

      const logo = (await page.getByTestId("boas-vindas-texto").locator("a").first().boundingBox())!;
      const titulo = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      expect(logo.y, "logo abaixo da foto").toBeGreaterThanOrEqual(caixaFoto.y + caixaFoto.height + 16);
      expect(logo.x - (w <= 576 ? 0 : (w - 576) / 2), "margem lateral de 24 px").toBeGreaterThanOrEqual(16);
      expect(Math.abs(logo.x - titulo.x), "logo alinhada ao título").toBeLessThanOrEqual(1);

      await expect(page.getByText("Imóveis mobiliados de 30 a 180 dias, com contrato de verdade.")).toBeVisible();
      await expect(page.getByText("Para quem vai morar um tempo fora e para quem quer alugar com segurança.")).toBeVisible();
      for (const nome of ["Quero alugar", "Quero anunciar", "Já tenho conta"]) {
        const c = (await page.getByRole("link", { name: nome }).boundingBox())!;
        expect(c.y + c.height, `${nome} cabe na tela`).toBeLessThanOrEqual(h);
      }
      const aviso = (await page.getByText("Lançamento oficial em 2027.").boundingBox())!;
      expect(aviso.y + aviso.height).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t282-boas-vindas-${w}x${h}.png` });
    });
  });
}
