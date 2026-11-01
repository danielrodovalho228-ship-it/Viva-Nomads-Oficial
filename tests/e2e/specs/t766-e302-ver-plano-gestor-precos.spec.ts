import { test, expect } from "@playwright/test";

/*
  T766 — E302 (resíduo de 01/11): em /precos, junto do "Falar sobre o Plano Gestor" (contato), a ação "Ver o Plano
  Gestor" rola até a seção #plano-gestor da própria página. A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T766 — E302: "Ver o Plano Gestor" em /precos rola até a seção (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/precos", { waitUntil: "domcontentloaded" });
    const botoes = page.getByTestId("precos-botoes");
    await expect(botoes.getByTestId("plano-gestor-botao")).toHaveText("Falar sobre o Plano Gestor");
    const ver = botoes.getByTestId("precos-ver-plano-gestor");
    await expect(ver).toHaveText("Ver o Plano Gestor");
    await expect(ver).toHaveAttribute("href", "#plano-gestor");
    // Começa do topo: a seção fora da tela; o clique leva até ela.
    await page.evaluate(() => window.scrollTo(0, 0));
    await ver.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 400));
    await ver.click();
    await expect(page).toHaveURL(/#plano-gestor$/);
    const secao = page.getByTestId("plano-gestor-secao");
    await expect(secao).toBeInViewport();
    await expect(secao).toContainText("Plano Gestor");
    await page.screenshot({ path: `${SAIDA}/t766-precos-plano-gestor-${largura}.png` });
  });
}
