import { test, expect, type Page } from "@playwright/test";
import { PRECOS_SUSPENSA } from "../fixtures/precos";

/*
  T860 — E563 (decisão do Daniel, 04/11/2026): com a página de preços SUSPENSA (chave PRECOS_VISIVEL desligada), nenhuma
  porta leva a ela — menu com 5 destinos (sem Planos), rodapé sem "Preços", home sem o cartão "Planos e taxas", /anunciar
  sem o destaque — e /precos e /planos vão para a home. 390 e 1280. Com a chave ligada, quem cobre é o t837 (E555).
*/
const SAIDA = "tests/laboratorio/saida";
const semRolagemLateral = (p: Page, l: number) => p.evaluate((x) => document.documentElement.scrollWidth - x, l);

for (const largura of [390, 1280] as const) {
  test.describe(`T860 — E563 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    test.skip(!PRECOS_SUSPENSA, "a página de preços está ligada: quem cobre as portas é o t837 (E555)");

    test("menu com 5 destinos, sem Planos", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      if (largura === 390) {
        await page.getByTestId("topo-publico").getByRole("button", { name: /menu/i }).click();
        await expect(page.getByTestId("nav-menu-lista").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas", "Parceiros", "Fale com a Viva", "Entrar"]);
        await page.screenshot({ path: `${SAIDA}/t860-menu-${largura}.png` });
      } else {
        await expect(page.getByTestId("nav-links").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas", "Parceiros"]);
        await expect(page.getByTestId("nav-fale-com-a-viva")).toBeVisible();
        await page.getByTestId("topo-publico").screenshot({ path: `${SAIDA}/t860-topo-${largura}.png` });
      }
      await expect(page.locator('header a[href="/planos"], header a[href^="/precos"]')).toHaveCount(0);
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
    });

    test("home sem o cartão 'Planos e taxas' e rodapé sem 'Preços'", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      await expect(page.getByTestId("bloco-proprietarios")).toBeVisible();
      await expect(page.getByTestId("home-planos-taxas")).toHaveCount(0);
      await expect(page.locator("footer").getByRole("link", { name: "Preços", exact: true })).toHaveCount(0);
      await expect(page.locator('main a[href="/planos"], main a[href^="/precos"], footer a[href="/planos"], footer a[href^="/precos"]')).toHaveCount(0);
      await page.getByTestId("bloco-proprietarios").screenshot({ path: `${SAIDA}/t860-home-${largura}.png` });
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
    });

    test("/anunciar sem o destaque nem link para os preços", async ({ page }) => {
      await page.goto("/anunciar", { waitUntil: "load" });
      await expect(page).toHaveURL(/\/para-proprietarios$/);
      await expect(page.getByTestId("anunciar-planos")).toHaveCount(0);
      await expect(page.locator('main a[href="/planos"], main a[href^="/precos"]')).toHaveCount(0);
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
    });

    test("/precos e /planos não abrem a página: vão para a home", async ({ page }) => {
      for (const rota of ["/precos", "/planos"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page, rota).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/Preços|Planos e taxas/);
      }
    });
  });
}
