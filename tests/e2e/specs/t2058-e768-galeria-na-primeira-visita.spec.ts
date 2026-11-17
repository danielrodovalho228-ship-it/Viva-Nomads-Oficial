import { test, expect } from "@playwright/test";

/*
  T2058 — E768 (Pista 3; autorizado pelo Gerente em 16/11) @E768 @ao-vivo-seguro
  Regra: o detalhe do anúncio abre com as fotos carregadas NA PRIMEIRA VISITA (antes, 5 em branco até recarregar): só a
  capa tem prioridade alta; as fotos pequenas do mosaico pedem a versão do tamanho do quadro (25vw; 34vw com 2–4 fotos,
  nunca a da foto grande) e carregam quando visíveis — no celular, escondidas, não disputam a rede com a capa.
  Visitante, só leitura, num navegador novo (sem cache) por largura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

async function primeiroAnuncio(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  const a = page.locator('a[href^="/imoveis/"]').first();
  await expect(a).toBeVisible({ timeout: 30_000 });
  return (await a.getAttribute("href"))!;
}

test.describe("T2058 — E768: as fotos do anúncio carregam na 1ª visita @E768 @ao-vivo-seguro", () => {
  test("1280 px: o mosaico inteiro fica pronto sem recarregar; capa eager, as pequenas lazy e do tamanho do quadro", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(await primeiroAnuncio(page), { waitUntil: "domcontentloaded" });
    const fotos = page.getByTestId("galeria-mosaico").locator("[data-foto-estado]");
    await expect(fotos.first()).toBeVisible({ timeout: 30_000 });
    const n = await fotos.count();
    for (let i = 0; i < n; i++) await expect(fotos.nth(i), `foto ${i + 1} do mosaico`).toHaveAttribute("data-foto-estado", "pronta", { timeout: 20_000 });
    const imgs = await fotos.locator("img").evaluateAll((es) => es.map((e) => ({ loading: e.getAttribute("loading"), prioridade: e.getAttribute("fetchpriority"), sizes: e.getAttribute("sizes") ?? "" })));
    expect(imgs[0].loading, "a capa carrega já").toBe("eager");
    for (const [i, im] of imgs.slice(1).entries()) {
      expect(im.loading, `pequena ${i + 2}: lazy`).toBe("lazy");
      expect(im.prioridade, `pequena ${i + 2}: sem prioridade alta`).not.toBe("high");
      expect(im.sizes, `pequena ${i + 2}: versão do tamanho do quadro`).toMatch(/\b(25|34)vw\b/);
      expect(im.sizes).not.toMatch(/\b50vw\b/);
    }
    await ctx.close();
  });

  test("390 px: a capa do carrossel fica pronta na 1ª visita e o mosaico escondido não pede fotos com prioridade", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(await primeiroAnuncio(page), { waitUntil: "domcontentloaded" });
    const capa = page.getByTestId("galeria-celular").locator("[data-foto-estado]").first();
    await expect(capa).toHaveAttribute("data-foto-estado", "pronta", { timeout: 20_000 });
    const escondidas = await page.getByTestId("galeria-mosaico").locator("img").evaluateAll((es) => es.slice(1).map((e) => ({ loading: e.getAttribute("loading"), prioridade: e.getAttribute("fetchpriority") })));
    for (const im of escondidas) {
      expect(im.loading).toBe("lazy");
      expect(im.prioridade).not.toBe("high");
    }
    await ctx.close();
  });
});
