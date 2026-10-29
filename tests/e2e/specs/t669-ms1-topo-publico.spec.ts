import { test, expect } from "@playwright/test";

/*
  T669 — MS-1/PUBLICO-A: topo público simples (Imóveis · Anunciar · Empresas + "Fale com a Viva" em texto + Entrar
  como único botão cheio), sem globo e sem menu "Mais". Publicar pedido, Como funciona, Preços e Parceiros no rodapé;
  Parceiros também dentro do Fale com a Viva. 1280 e 390, com prints.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [1280, 390] as const) {
  test.describe(`T669 — topo público a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("topo simples; o resto no rodapé; Parceiros no Fale com a Viva", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const topo = page.getByTestId("topo-publico");
      await expect(topo).toBeVisible({ timeout: 30_000 });
      if (largura === 1280) {
        await expect(page.getByTestId("nav-links").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas"]);
        await expect(page.getByTestId("nav-fale-com-a-viva")).toHaveText("Fale com a Viva");
        await expect(page.getByTestId("nav-entrar")).toHaveText("Entrar");
      } else {
        await page.getByTestId("nav-menu").click();
        await expect(page.getByTestId("nav-menu-lista").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas", "Fale com a Viva", "Entrar"]);
      }
      for (const fora of ["Publicar pedido", "Como funciona", "Preços", "Parceiros", "Mais"]) await expect(topo.getByText(fora, { exact: true })).toHaveCount(0);
      await expect(topo.locator('[aria-label*="idioma" i], [data-testid*="idioma"]')).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t669-topo-${largura}.png` });

      const rodape = page.locator("footer");
      for (const [nome, href] of [["Publicar pedido", "/pedidos/novo"], ["Como funciona", "/como-funciona"], ["Preços", "/precos"], ["Parceiros", "/parceiros"]] as const)
        await expect(rodape.getByRole("link", { name: nome, exact: true })).toHaveAttribute("href", href);
      await rodape.scrollIntoViewIfNeeded();
      await rodape.screenshot({ path: `${SAIDA}/t669-rodape-${largura}.png` });

      await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
      const parceiros = page.getByTestId("fale-parceiros");
      await expect(parceiros).toHaveAttribute("href", "/parceiros", { timeout: 30_000 });
      await parceiros.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t669-fale-parceiros-${largura}.png` });
    });
  });
}
