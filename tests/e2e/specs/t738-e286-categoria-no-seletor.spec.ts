import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T738 — E286 (conferência do Muse, 30/10), busca de parceiros como visitante, a 1280 e 390: o menu "Categoria" do
  formulário mostra a categoria aberta na URL e no título. Antes, ao chegar pela faixa de categorias (navegação no
  cliente), o seletor ficava em "Todas" com /parceiros/buscar?categoria=montagem aberto.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T738 — E286: o seletor de Categoria reflete a categoria da URL", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 90_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: direto pela URL e pela faixa de categorias`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      const seletor = p.locator("#bp-categoria");

      await p.goto("/parceiros/buscar?categoria=montagem", { waitUntil: "domcontentloaded" });
      await expect(p.locator("h1")).toHaveText(/montagem/i);
      await expect(seletor).toHaveValue("montagem");

      // Pela faixa (Link do Next, sem recarregar): Todas → Montagem → Limpeza.
      await p.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      await expect(seletor).toHaveValue("");
      await p.getByTestId("faixa-categoria-montagem").click();
      await expect(p).toHaveURL(/categoria=montagem/, { timeout: 30_000 });
      await expect(p.locator("h1")).toHaveText(/montagem/i);
      await expect(seletor).toHaveValue("montagem");
      await p.getByTestId("faixa-categoria-limpeza").click();
      await expect(p).toHaveURL(/categoria=limpeza/, { timeout: 30_000 });
      await expect(seletor).toHaveValue("limpeza");
      await p.locator("#bp-categoria").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t738-seletor-${largura}.png` });
      await ctx.close();
    });
  }
});
