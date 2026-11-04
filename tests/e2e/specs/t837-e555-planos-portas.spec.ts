import { test, expect, type Page } from "@playwright/test";

/*
  T837 — E555 (pacote Planos): as portas para /planos, no computador (1280) e no celular (390).
  - menu público: 6 destinos (Imóveis · Anunciar · Empresas · Parceiros · Planos · Fale com a Viva); Planos → /planos;
  - home, bloco de proprietários: cartão "Planos e taxas" → /planos;
  - rodapé: "Preços" → /planos;
  - /anunciar (→ /para-proprietarios): destaque "Planos e taxas" no topo → /planos;
  - /planos abre a página de planos e taxas.
*/
const SAIDA = "tests/laboratorio/saida";
const semRolagemLateral = (p: Page, l: number) => p.evaluate((x) => document.documentElement.scrollWidth - x, l);

for (const largura of [390, 1280] as const) {
  test.describe(`T837 — E555 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("menu: Planos entre Parceiros e Fale com a Viva, para /planos", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      if (largura === 390) {
        await page.getByTestId("topo-publico").getByRole("button", { name: /menu/i }).click();
        const lista = page.getByTestId("nav-menu-lista");
        await expect(lista.getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas", "Parceiros", "Planos", "Fale com a Viva", "Entrar"]);
        await expect(lista.getByRole("link", { name: "Planos", exact: true })).toHaveAttribute("href", "/planos");
        await page.screenshot({ path: `${SAIDA}/t837-menu-${largura}.png` });
      } else {
        const links = page.getByTestId("nav-links").getByRole("link");
        await expect(links).toHaveText(["Imóveis", "Anunciar", "Empresas", "Parceiros", "Planos"]);
        await expect(page.getByTestId("nav-links").getByRole("link", { name: "Planos", exact: true })).toHaveAttribute("href", "/planos");
        await expect(page.getByTestId("nav-fale-com-a-viva")).toBeVisible();
        const topos = await links.evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().top), e.getClientRects().length]));
        expect(new Set(topos.map((t) => t[0])).size, JSON.stringify(topos)).toBe(1);
        for (const t of topos) expect(t[1]).toBe(1);
        await page.getByTestId("topo-publico").screenshot({ path: `${SAIDA}/t837-topo-${largura}.png` });
      }
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
    });

    test("home: cartão 'Planos e taxas'; rodapé: 'Preços' → /planos", async ({ page }) => {
      await page.goto("/", { waitUntil: "load" });
      const cartao = page.getByTestId("bloco-proprietarios").getByTestId("home-planos-taxas");
      await expect(cartao).toBeVisible();
      await expect(cartao).toHaveAttribute("href", "/planos");
      await expect(cartao).toContainText("Planos e taxas");
      expect((await cartao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.getByTestId("bloco-proprietarios").screenshot({ path: `${SAIDA}/t837-home-${largura}.png` });
      await expect(page.locator("footer").getByRole("link", { name: "Preços", exact: true })).toHaveAttribute("href", "/planos");
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
    });

    test("/anunciar: destaque 'Planos e taxas' no topo; /planos abre os planos e taxas", async ({ page }) => {
      await page.goto("/anunciar", { waitUntil: "load" });
      await expect(page).toHaveURL(/\/para-proprietarios$/);
      const destaque = page.getByTestId("anunciar-planos");
      await expect(destaque).toBeVisible();
      await expect(destaque).toHaveAttribute("href", "/planos");
      expect(await semRolagemLateral(page, largura)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t837-anunciar-${largura}.png` });
      await destaque.click();
      await expect(page).toHaveURL(/\/precos$/);
    });
  });
}
