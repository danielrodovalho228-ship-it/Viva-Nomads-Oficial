import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T846 — E513 (D-S2-09, A+B): no Início do dono, a lista "Meus imóveis" mostra a foto REAL de cada anúncio (que carrega)
  ou o espaço "sem foto" — nunca uma foto do acervo (placeholder-imovel-*) repetida entre anúncios sem capa, como
  aparecia nos pausados. 1280 e 390.
*/
for (const largura of [1280, 390] as const) {
  test.describe(`T846 — E513 (${largura}px)`, () => {
    test.skip(!hasAccount("proprietario"), "sem conta de proprietário de teste");
    test.use({ storageState: authFile("proprietario"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("Meus imóveis: capa real que carrega ou espaço sem foto; nenhuma foto do acervo", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      const painel = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Meus imóveis", exact: true }) }).last();
      if (!(await painel.count())) test.skip(true, "conta sem imóvel publicado");
      const r = await painel.evaluate(async (el) => {
        const imgs = [...el.querySelectorAll("li img")] as HTMLImageElement[];
        await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.addEventListener("load", ok, { once: true }); i.addEventListener("error", ok, { once: true }); setTimeout(ok, 10_000); }))));
        return {
          acervo: imgs.map((i) => i.currentSrc || i.src).filter((s) => decodeURIComponent(s).includes("placeholder-imovel-")),
          quebradas: imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length,
        };
      });
      expect(r).toEqual({ acervo: [], quebradas: 0 });
      await painel.screenshot({ path: `tests/laboratorio/saida/t846-meus-imoveis-${largura}.png` });
    });
  });
}
