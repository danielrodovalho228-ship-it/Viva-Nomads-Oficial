import { test, expect, type Page } from "@playwright/test";

/**
 * T72 — ordem 5a4b9146: páginas institucionais.
 *  1. Todas com banner de topo em LARGURA TOTAL, com foto carregada e o h1 dentro.
 *  2. Nenhum link do cabeçalho leva a 404 (inclui o menu "Mais" e o menu do celular).
 *  3. Endereços "naturais" que davam 404 redirecionam (/para-empresas, /publicar-pedido).
 *  4. /pedidos/novo: as caixas do formulário têm a mesma altura e largura alinhada.
 *  5. Comparações com outras plataformas continuam na página.
 *  6. Sem rolagem lateral a 390 e 1280 px; prints.
 */
const PAGINAS = ["/para-proprietarios", "/empresas", "/precos", "/como-funciona", "/parceiros"];
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T72 — páginas institucionais", () => {
  for (const largura of [390, 1280]) {
    test(`1/6. banner full-width com foto em todas as páginas (${largura}px)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: 900 });
      for (const rota of PAGINAS) {
        const r = await page.goto(rota, { waitUntil: "networkidle" });
        expect(r?.status(), rota).toBe(200);
        const banner = page.getByTestId("banner-topo");
        await expect(banner, rota).toBeVisible();
        const box = (await banner.boundingBox())!;
        expect(Math.round(box.x), `${rota} encosta à esquerda`).toBe(0);
        expect(Math.round(box.width), `${rota} largura total`).toBe(largura);
        expect(box.height, `${rota} banner com altura de destaque`).toBeGreaterThanOrEqual(300);
        const foto = banner.locator("img").first();
        await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { message: `${rota} foto carregada` }).toBe(true);
        await expect(banner.getByRole("heading", { level: 1 }), rota).toBeVisible();
        expect(await semRolagem(page), `${rota} sem rolagem lateral`).toBeLessThanOrEqual(1);
        if (largura === 1280) await page.screenshot({ path: `tests/laboratorio/saida/t72${rota.replace(/\//g, "-")}-1280.png` });
      }
    });
  }

  test("2. nenhum link do cabeçalho leva a 404 (desktop, menu Mais e celular)", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    const header = page.locator("header").first();
    await header.getByRole("button", { name: "Mais" }).click();
    const desktop = await header.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const celular = await page.locator("header").first().locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    const links = [...new Set([...desktop, ...celular])].filter((h) => !h.startsWith("/dashboard") && !h.startsWith("/auth"));
    expect(links.length).toBeGreaterThanOrEqual(7);
    for (const href of links) {
      const r = await request.get(href);
      expect(r.status(), href).toBeLessThan(400);
    }
  });

  test("3. /para-empresas e /publicar-pedido redirecionam (sem 404)", async ({ page }) => {
    await page.goto("/para-empresas");
    await expect(page).toHaveURL(/\/empresas$/);
    await page.goto("/publicar-pedido");
    await expect(page).toHaveURL(/\/pedidos\/novo$/);
  });

  test("4. /pedidos/novo: caixas do formulário com a mesma altura", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Publique seu pedido" })).toBeVisible();
    const alturas = await page
      .locator("form input:not([type=checkbox]):not([type=hidden]), form select, form button[aria-pressed], form [data-testid=pedido-pessoas]")
      .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(alturas.length).toBeGreaterThanOrEqual(6);
    expect(new Set(alturas), `alturas ${alturas.join(",")}`).toEqual(new Set([48]));
    await page.screenshot({ path: "tests/laboratorio/saida/t72-pedidos-novo-1280.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    expect(await semRolagem(page)).toBeLessThanOrEqual(1);
  });

  test("5. comparações com outras plataformas intactas", async ({ page }) => {
    // /para-proprietarios (versão curta) ainda segue a regra c6b62141; /precos mudou no prompt 13.
    await page.goto("/para-proprietarios", { waitUntil: "networkidle" });
    const curto = page.getByTestId("comparativo-curto");
    await expect(curto).toContainText("Viva Nomads");
    await expect(curto).toContainText("Airbnb");
    await expect(curto).toContainText("QuintoAndar");
    // /precos (prompt 13, decisão do Daniel em 17/10): Viva × Airbnb × Booking.com × anúncio por conta própria.
    await page.goto("/precos#compare", { waitUntil: "networkidle" });
    const linhas = page.getByTestId("comparativo-linhas");
    await expect(linhas).toContainText("Viva Nomads");
    await expect(linhas).toContainText("Airbnb");
    await expect(linhas).toContainText("Booking.com");
    await expect(linhas).toContainText("Anúncio por conta própria");
    await expect(linhas).not.toContainText("QuintoAndar");
    await expect(page.getByTestId("diferenciais-viva").first()).toBeVisible();
    await expect(page.getByTestId("regra-unica")).toBeVisible();
    await expect(page.getByTestId("faixas-taxa")).toBeVisible();
    await expect(page.getByTestId("precos-opcionais")).toBeVisible();
  });
});
