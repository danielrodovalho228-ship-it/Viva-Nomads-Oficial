import { test, expect } from "@playwright/test";

/*
  T283 — Prompt 57, item 6, a 390 e 1280 px: a home não promete "aguenta videochamadas" e diz que a internet é
  informada pelo proprietário (com o número quando medida no imóvel).
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test.describe(`T283 — ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("home: internet sem promessa de capacidade", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const frase = page.getByText("Internet informada pelo proprietário; quando medida no imóvel, o anúncio mostra o número.", { exact: false });
      await expect(frase).toBeVisible({ timeout: 25_000 });
      const texto = await page.locator("main").innerText();
      expect(texto).not.toMatch(/videochamada/i);
      expect(texto).not.toMatch(/internet boa para o trabalho/i);
      await frase.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t283-home-internet-${largura}.png` });
    });
  });
}
