import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T797 — conformidade do cadastro (01/11, Pista A): no Passo 10 (Revisar), o convite de foto diz "proprietário", nunca
  "anfitrião" (vocabulário da casa). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("proprietario") });

for (const largura of [390, 1280] as const) {
  test(`T797 — Passo 10 sem "anfitrião" (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/imoveis/novo?etapa=revisao", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const main = page.locator("main");
    await expect(main).toBeVisible();
    const convite = page.getByTestId("convite-foto-anuncio");
    if (await convite.count()) await expect(convite).toContainText("Anúncios com foto do proprietário passam mais confiança");
    expect(await main.innerText()).not.toMatch(/anfitri/i);
    await page.screenshot({ path: `${SAIDA}/t797-revisao-${largura}.png` });
  });
}
