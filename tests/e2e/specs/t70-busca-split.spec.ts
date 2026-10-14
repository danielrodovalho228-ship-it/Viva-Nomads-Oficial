import { test, expect, type Page } from "@playwright/test";

/**
 * T70 — ordem ca0e7dad: busca do computador em tela dividida (padrão Furnished
 * Finder, identidade Viva Nomads).
 *  1. Largura total: lista ~55–60% com 3 cards por linha; mapa ~40–45% encostado
 *     na borda direita, fixo e na altura visível; filtros numa faixa de uma linha.
 *  2. Um pin de preço por imóvel. Hover no card destaca o pin; hover no pin só
 *     destaca (pin + card), sem balão.
 *  3. Clique no pin abre o card ancorado no mapa (foto, título, cidade, preço/mês,
 *     quartos/banheiros), sem sair da página; o × fecha.
 *  4. Celular (390 px): layout atual, sem mapa.
 */
async function abrir(page: Page, largura: number, altura = 900) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto("/buscar", { waitUntil: "networkidle" });
}

/** Ids dos pins que estão na tela e não estão cobertos por outro pin. */
async function pinsLivres(page: Page): Promise<string[]> {
  await expect(page.getByTestId("pin-mapa").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="pin-mapa"]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return r.width > 0 && !!topo && el.contains(topo);
      })
      .map((el) => el.dataset.id!)
  );
}

test.describe("T70 — busca split-screen no computador", () => {
  test("1. proporções, 3 por linha, mapa fixo na altura da tela e filtros em uma linha", async ({ page }) => {
    await abrir(page, 1440);
    const lista = await page.getByTestId("busca-lista").boundingBox();
    const mapa = await page.getByTestId("busca-mapa").boundingBox();
    expect(lista && mapa).toBeTruthy();
    const pctLista = lista!.width / 1440;
    const pctMapa = mapa!.width / 1440;
    expect(pctLista).toBeGreaterThanOrEqual(0.53);
    expect(pctLista).toBeLessThanOrEqual(0.6);
    expect(pctMapa).toBeGreaterThanOrEqual(0.4);
    expect(pctMapa).toBeLessThanOrEqual(0.45);
    expect(Math.round(mapa!.x + mapa!.width), "mapa encosta na borda direita").toBe(1440);

    // Ordem eac7e3a1: filtros completos abrem pela busca compacta do cabeçalho.
    await page.getByTestId("busca-compacta").click();
    const caixa = await page.getByTestId("filtros-caixa").boundingBox();
    expect(caixa!.height, "barra de filtros em uma linha").toBeLessThanOrEqual(64);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("filtros-caixa")).toBeHidden();

    const cards = page.getByTestId("card-resultado");
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    const tops = await Promise.all([0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!.y));
    expect(new Set(tops.map(Math.round)).size, "3 cards na primeira linha").toBe(1);
    const quarto = await cards.nth(3).boundingBox();
    if (quarto) expect(quarto.y).toBeGreaterThan(tops[0]);

    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(400);
    const depois = await page.getByTestId("busca-mapa").boundingBox();
    expect(Math.round(depois!.y), "mapa fixo logo abaixo do cabeçalho (sem faixa)").toBe(72);
    expect(depois!.height, "mapa na altura visível (tela − cabeçalho)").toBeGreaterThanOrEqual(900 - 80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.mouse.wheel(0, -3000);
    await page.waitForTimeout(300);
    await page.screenshot({ path: "tests/laboratorio/saida/t70-busca-1440.png" });
  });

  test("2. um pin por imóvel; hover card↔pin só destaca", async ({ page }) => {
    await abrir(page, 1440);
    const cards = page.getByTestId("card-resultado");
    const pins = page.getByTestId("pin-mapa");
    await expect(pins.first()).toBeVisible({ timeout: 15_000 });
    expect(await pins.count()).toBe(await cards.count());
    // Todos os pins dentro do mapa (enquadramento).
    const mapa = (await page.getByTestId("mapa-busca").boundingBox())!;
    for (const b of await pins.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(b.left).toBeGreaterThanOrEqual(mapa.x - 1);
      expect(b.right).toBeLessThanOrEqual(mapa.x + mapa.width + 1);
    }

    const id = await cards.first().getAttribute("data-id");
    await cards.first().hover();
    await expect(page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`)).toHaveAttribute("data-ativo", "1");

    const livres = await pinsLivres(page);
    expect(livres.length).toBeGreaterThan(0);
    const idPin = livres[livres.length - 1];
    await page.mouse.move(5, 5);
    await page.locator(`[data-testid="pin-mapa"][data-id="${idPin}"]`).hover();
    await expect(page.locator(`[data-testid="pin-mapa"][data-id="${idPin}"]`)).toHaveAttribute("data-ativo", "1");
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${idPin}"]`)).toHaveAttribute("data-destaque", "1");
    await expect(page.getByTestId("card-pin-mapa"), "hover não abre balão").toHaveCount(0);
  });

  test("3. clique no pin abre o card no mapa, sem sair da página; × fecha", async ({ page }) => {
    await abrir(page, 1440);
    const [id] = await pinsLivres(page);
    expect(id).toBeTruthy();
    const pin = page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`);
    const url = page.url();
    await pin.click();
    const card = page.getByTestId("card-pin-mapa");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-id", id!);
    await expect(card).toContainText("/mês");
    await expect(card).toContainText(/quartos?/);
    await expect(card).toContainText(/banheiros?/);
    expect(page.url()).toBe(url);
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${id}"]`)).toHaveAttribute("data-destaque", "1");
    await page.screenshot({ path: "tests/laboratorio/saida/t70-card-no-mapa-1440.png" });
    await card.getByRole("button", { name: "Fechar" }).click();
    await expect(card).toHaveCount(0);
    await pin.click();
    await expect(card).toBeVisible();
    await card.locator("a").first().click();
    await expect(page).toHaveURL(new RegExp(`/imoveis/${id}`));
  });

  test("4. celular 390 px: sem mapa, busca do celular de sempre", async ({ page }) => {
    await abrir(page, 390, 844);
    await expect(page.getByTestId("busca-celular")).toBeVisible();
    await expect(page.getByTestId("busca-mapa")).toBeHidden();
    await expect(page.getByTestId("mapa-busca")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("5. 1024 e 1280 px: tela dividida sem rolagem lateral e filtros numa linha", async ({ page }) => {
    for (const largura of [1024, 1280]) {
      await abrir(page, largura);
      await expect(page.getByTestId("busca-mapa")).toBeVisible();
      await expect(page.getByTestId("busca-compacta")).toBeVisible();
      await page.getByTestId("busca-compacta").click();
      const caixa = await page.getByTestId("filtros-caixa").boundingBox();
      expect(caixa!.height, `filtros em uma linha a ${largura}px`).toBeLessThanOrEqual(64);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  });
  test("6. privacidade: payload da busca, HTML do anúncio e JSON-LD sem coordenada com mais de 3 casas (ordens 7193d35a, 00552cd1)", async ({ page, request }) => {
    // lat/lng (ou latitude/longitude) com 4+ casas decimais = coordenada exata vazando.
    const exata = /["\\]*(?:lat|lng|latitude|longitude)["\\]*\s*[:=]\s*-?\d+\.\d{4,}/i;
    const api = await request.get("/api/properties");
    expect(api.ok()).toBeTruthy();
    const corpoApi = await api.text();
    expect(corpoApi, "payload /api/properties").not.toMatch(exata);

    const busca = await request.get("/buscar");
    expect(await busca.text(), "HTML da /buscar").not.toMatch(exata);

    await abrir(page, 1440);
    const id = await page.getByTestId("card-resultado").first().getAttribute("data-id");
    expect(id).toBeTruthy();
    const anuncio = await request.get(`/imoveis/${id}`);
    expect(anuncio.ok()).toBeTruthy();
    const html = await anuncio.text();
    expect(html, "HTML do anúncio").not.toMatch(exata);
    expect(html, "JSON-LD sem geo exato").not.toContain("GeoCoordinates");
  });
});
