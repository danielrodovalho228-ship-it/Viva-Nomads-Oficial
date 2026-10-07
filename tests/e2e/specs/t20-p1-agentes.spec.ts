import { test, expect } from "@playwright/test";

/**
 * T20 — Achados P1 dos agentes: conferência pública, SEO (index, sitemap,
 * JSON-LD, llms.txt), redirecionamento de /anunciar e anúncio sem
 * "Garantia de correspondência".
 */
test.describe("T20 — P1 dos agentes", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/conferir com código inválido avisa e não sai da página", async ({ page }) => {
    await page.goto("/conferir", { waitUntil: "networkidle" });
    await page.getByLabel("Código de conferência").fill("abc123");
    await page.getByRole("button", { name: "Conferir" }).click();
    await expect(page.getByTestId("conferir-codigo-invalido")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/conferir");
  });

  test("/conferir com código válido leva ao documento verdadeiro", async ({ page }) => {
    const codigo = process.env.TESTES_CONFERIR_CODIGO;
    test.skip(!codigo, "seed sem TESTES_CONFERIR_CODIGO");
    await page.goto("/conferir", { waitUntil: "networkidle" });
    await page.getByLabel("Código de conferência").fill(codigo!.toUpperCase());
    await page.getByRole("button", { name: "Conferir" }).click();
    await page.waitForURL(`**/conferir/${codigo}`);
    await expect(page.getByTestId("conferir-ok")).toBeVisible();
  });

  test("/cidades/uberlandia pode ser indexada", async ({ page }) => {
    await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "").not.toMatch(/noindex/);
  });

  test("sitemap sem URLs que dão 404", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(locs).toContain("/cidades/uberlandia");
    expect(locs).not.toContain("/cidades");
    expect(locs).not.toContain("/uberlandia");
    for (const p of locs.filter((l) => !l.startsWith("/imoveis/"))) {
      const r = await request.get(p, { maxRedirects: 0 });
      expect(r.status(), p).toBe(200);
    }
  });

  test("/anunciar redireciona 301 para /para-proprietarios", async ({ request }) => {
    const r = await request.get("/anunciar", { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toMatch(/\/para-proprietarios$/);
  });

  test("/llms.txt e /llms-full.txt em texto, sem imóveis de exemplo", async ({ request }) => {
    for (const p of ["/llms.txt", "/llms-full.txt"]) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
      expect(r.headers()["content-type"]).toMatch(/text\/plain/);
      const t = await r.text();
      expect(t).toContain("Viva Nomads");
      expect(t).not.toMatch(/ube-\d/);
    }
  });

  for (const [rota, tipo] of [
    ["/", "Organization"],
    ["/ajuda", "FAQPage"],
    ["/precos", "Offer"],
    ["/buscar", "ItemList"],
  ] as const) {
    test(`JSON-LD ${tipo} em ${rota}`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
      const tudo = blocos.map((b) => JSON.parse(b));
      expect(JSON.stringify(tudo)).toContain(`"${tipo}"`);
    });
  }

  test("anúncio não promete 'Garantia de correspondência'", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Garantia de correspond/i);
  });
});
