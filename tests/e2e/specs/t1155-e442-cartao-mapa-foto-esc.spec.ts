import { test, expect, type Page } from "@playwright/test";

/**
 * T1155 — E442 (#2613, 05/11): o hover no preço do mapa da busca volta a abrir o cartão do imóvel. A t887 (Pista A)
 * cobre o cartão certo, o mouse até ele, o clique no anúncio e o toque a 390. Aqui o que ela não mede:
 *   1. a FOTO do cartão carrega de verdade (complete e naturalWidth > 0), a 1280 no hover e a 390 no toque;
 *   2. Esc fecha o cartão e limpa a prévia (953171ce5): depois do Esc nada fica aberto, e um novo hover reabre o
 *      cartão do mesmo imóvel (a prévia não fica presa).
 */
async function abrirMapa(page: Page, largura: number) {
  await page.goto("/buscar", { waitUntil: "networkidle" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pin-mapa").first()).toBeAttached({ timeout: 20_000 });
}

async function pinLivre(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const pins = [...document.querySelectorAll<HTMLElement>('[data-testid="pin-mapa"]')];
    const livres = pins.filter((e) => {
      const r = e.getBoundingClientRect();
      const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.width > 0 && !!topo && e.contains(topo);
    });
    return livres[Math.floor(livres.length / 2)]?.dataset.id ?? null;
  });
  expect(id, "um pin livre no mapa").toBeTruthy();
  return id!;
}

async function fotoCarregada(page: Page, id: string) {
  const card = page.getByTestId("card-pin-mapa");
  await expect(card).toHaveAttribute("data-id", id);
  const img = card.locator("img").first();
  await expect(img).toBeVisible();
  await expect
    .poll(async () => img.evaluate((e: HTMLImageElement) => (e.complete ? e.naturalWidth : 0)), { timeout: 15_000, message: "a foto do cartão carregou" })
    .toBeGreaterThan(0);
}

test.describe("T1155 — E442: a foto do cartão do mapa carrega e o Esc fecha (1280)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("hover: foto carregada; Esc fecha; novo hover reabre o mesmo imóvel", async ({ page }) => {
    await abrirMapa(page, 1280);
    const id = await pinLivre(page);
    const pin = page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`);
    await pin.hover();
    await fotoCarregada(page, id);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("card-pin-mapa")).toHaveCount(0, { timeout: 3_000 });

    await page.mouse.move(5, 5);
    await pin.hover();
    await fotoCarregada(page, id);
  });
});

test.describe("T1155 — E442: a foto do cartão do mapa carrega no toque (390)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("toque: foto do cartão carregada, sem estouro horizontal", async ({ page }) => {
    await abrirMapa(page, 390);
    const id = await pinLivre(page);
    await page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`).tap();
    await fotoCarregada(page, id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
