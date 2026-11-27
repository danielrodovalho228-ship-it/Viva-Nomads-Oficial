import { test, expect, type Page } from "@playwright/test";

/*
  T899 — E442 (regressão, prioridade alta): no mapa da busca, passar o mouse sobre o PREÇO abre o cartão do imóvel —
  foto, título, valor/mês — e o clique no cartão leva ao anúncio certo. O hover se perdeu na ordem ca0e7dad (14/10,
  commit 41b55043d: "hover só destaca") e sobrava a etiqueta nativa (title) do Leaflet. Teste permanente do hover:
    1280 — hover no preço abre o cartão do MESMO imóvel; o cartão fica aberto ao levar o mouse até ele; clicar leva a
           /imoveis/<id>; tirar o mouse do preço (sem ir ao cartão) fecha; nenhum `title` nativo no pin;
    390 (toque) — tocar no preço abre o mesmo cartão (foto, título, valor/mês, link do anúncio).
*/
const SAIDA = "tests/laboratorio/saida";

async function abrirMapa(page: Page, largura: number) {
  await page.goto("/buscar", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  if (largura < 1024) {
    const botao = page.getByRole("button", { name: /mapa/i }).first();
    if (await botao.isVisible().catch(() => false)) await botao.click();
  }
  await expect(page.getByTestId("mapa-busca")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pin-mapa").first()).toBeAttached({ timeout: 20_000 });
}

/** Um pin livre (no mapa, sem outro por cima) — o do meio da lista, longe das bordas. */
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

async function conferirCartao(page: Page, id: string) {
  const card = page.getByTestId("card-pin-mapa");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-id", id);
  await expect(card.locator("img").first()).toBeVisible();
  await expect(card.locator("p").first()).not.toBeEmpty();
  await expect(card).toContainText("/mês");
  await expect(card.locator("a").first()).toHaveAttribute("href", `/imoveis/${id}`);
  return card;
}

test.describe("T899 — E442: hover no preço do mapa abre o cartão (1280)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("hover abre o cartão certo, o mouse chega até ele e o clique leva ao anúncio; sair fecha", async ({ page }) => {
    await abrirMapa(page, 1280);
    // Sem etiqueta nativa no pin (era o "texto simples").
    expect(await page.locator('[data-testid="pin-mapa"]').evaluateAll((es) => es.filter((e) => e.closest("[title]")).length)).toBe(0);

    const id = await pinLivre(page);
    const pin = page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`);
    await pin.hover();
    const card = await conferirCartao(page, id);
    await page.screenshot({ path: `${SAIDA}/t899-hover-1280.png` });

    // Tirar o mouse do preço para longe (sem passar pelo cartão): fecha.
    await page.mouse.move(5, 5);
    await expect(card).toHaveCount(0, { timeout: 3_000 });

    // De novo: hover e leva o mouse até o cartão — fica aberto e o clique abre o anúncio certo.
    await pin.hover();
    await conferirCartao(page, id);
    await card.hover();
    await page.waitForTimeout(800);
    await expect(card).toBeVisible();
    await card.locator("a").first().click();
    await expect(page).toHaveURL(new RegExp(`/imoveis/${id}$`));
  });
});

test.describe("T899 — E442: toque no preço abre o mesmo cartão (390)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("tocar no preço abre o cartão (foto, título, valor/mês, link do anúncio)", async ({ page }) => {
    await abrirMapa(page, 390);
    const id = await pinLivre(page);
    await page.locator(`[data-testid="pin-mapa"][data-id="${id}"]`).tap();
    await conferirCartao(page, id);
    await page.screenshot({ path: `${SAIDA}/t899-toque-390.png` });
  });
});
