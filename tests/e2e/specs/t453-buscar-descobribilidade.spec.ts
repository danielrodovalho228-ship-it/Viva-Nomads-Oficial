import { test, expect } from "@playwright/test";

/**
 * T453 — E106 (descobribilidade na /buscar), no uso real do Daniel:
 *  1. "Publicar pedido" também na linha da contagem, como ação de texto junto de "Salvar busca" e "Descrever o que
 *     procuro" (entrada SECUNDÁRIA: nenhum botão primário novo), levando a cidade da busca.
 *  2. No painel Local, o "Tempo máximo até o trabalho" aparece já ao abrir — desabilitado, com a dica "escolha um
 *     destino" — e, escolhido o destino, vira o seletor com os minutos.
 *  Em 390 e 1280 px, com prints.
 */
const SAIDA = "tests/laboratorio/saida";

for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test.describe(`T453 — /buscar: pedido e tempo de trajeto à vista, a ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: altura });
    });

    test("1. 'Publicar pedido' na linha da contagem, como texto (sem 2º primário)", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      const linha = page.getByTestId("linha-contagem");
      const pedido = linha.getByTestId("linha-publicar-pedido");
      await expect(pedido).toBeVisible({ timeout: 30_000 });
      await expect(pedido).toHaveText("Publicar pedido");
      // A cidade entra no link quando a busca assenta (a URL é lida depois da hidratação).
      await expect
        .poll(async () => new URLSearchParams(((await pedido.getAttribute("href")) ?? "").split("?")[1] ?? "").get("cidade"), { timeout: 15_000 })
        .toBe("Uberlândia");
      // Texto como as outras ações da linha: sem fundo, sublinhado, na mesma altura do "Descrever o que procuro".
      expect(await pedido.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      expect(await pedido.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
      const p = (await pedido.boundingBox())!;
      const d = (await linha.getByTestId("abrir-descrever").boundingBox())!;
      expect(Math.abs(p.y - d.y), "na mesma linha das outras ações").toBeLessThanOrEqual(2);
      // Um primário só na tela de cima (nenhum botão verde novo na linha).
      expect(await linha.locator('[data-cta="primary"]').count()).toBe(0);
      await page.screenshot({ path: `${SAIDA}/t453-linha-pedido-${largura}.png`, fullPage: false });
      await pedido.click();
      await expect(page).toHaveURL(/\/pedidos\/novo\?.*cidade=Uberl/);
    });

    test("2. o tempo de trajeto à vista em 1 clique (pílula Local), desabilitado até o destino", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      await expect(async () => {
        await page.getByTestId("pilula-local").click({ timeout: 5_000 });
        await expect(page.getByTestId("painel-pilula-local")).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
      const painel = page.getByTestId("painel-pilula-local");
      const ate = painel.getByTestId("destino-ate");
      await expect(ate).toBeVisible();
      await expect(ate).toBeDisabled();
      await expect(painel.getByTestId("destino-ate-espera")).toContainText("Tempo máximo até o trabalho");
      await expect(ate.locator("option")).toHaveText(["escolha um destino"]);
      await expect(painel.getByTestId("destino-ate-dica")).toBeVisible();
      await ate.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t453-local-tempo-${largura}.png`, fullPage: false });
      // Escolhido um destino, o mesmo seletor libera os minutos.
      const chip = painel.getByTestId("destinos-chips").locator("button").first();
      if (await chip.count()) {
        await chip.click();
        await expect(painel.getByTestId("destino-ate")).toBeEnabled({ timeout: 15_000 });
        await expect(painel.getByTestId("destino-opcoes")).toBeVisible();
        await page.screenshot({ path: `${SAIDA}/t453-local-tempo-destino-${largura}.png`, fullPage: false });
      }
    });
  });
}
