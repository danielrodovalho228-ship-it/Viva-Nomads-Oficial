import { test, expect, type Page } from "@playwright/test";

/*
  T783 — E408 (01/11): o lightbox da galeria do anúncio fecha clicando no fundo escuro (fora da foto e dos botões),
  como os outros diálogos do site; clique na foto ou em "Próxima foto" não fecha; Esc e o X seguem. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

async function abrir(page: Page) {
  const tile = page.getByTestId("galeria-tile-0").filter({ visible: true }).first();
  await tile.scrollIntoViewIfNeeded();
  await expect(async () => {
    if (!(await page.getByTestId("galeria-lightbox").isVisible())) await tile.click({ timeout: 3_000 });
    await expect(page.getByTestId("galeria-lightbox")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

for (const largura of [390, 1280] as const) {
  test(`T783 — E408: lightbox fecha no fundo, não na foto (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const caixa = page.getByTestId("galeria-lightbox");

    await abrir(page);
    await expect(caixa).toHaveAttribute("role", "dialog");
    await page.getByTestId("galeria-lightbox-foto").click({ position: { x: 40, y: 40 } });
    await expect(caixa).toBeVisible();
    await caixa.getByRole("button", { name: "Próxima foto" }).click();
    await expect(caixa).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t783-lightbox-${largura}.png` });
    const fundo = (await page.getByTestId("galeria-lightbox-fundo").boundingBox())!;
    await page.mouse.click(fundo.x + 4, fundo.y + fundo.height - 4);
    await expect(caixa).toHaveCount(0);

    await abrir(page);
    await page.keyboard.press("Escape");
    await expect(caixa).toHaveCount(0);
    await abrir(page);
    await caixa.getByRole("button", { name: "Fechar" }).click();
    await expect(caixa).toHaveCount(0);
  });
}
