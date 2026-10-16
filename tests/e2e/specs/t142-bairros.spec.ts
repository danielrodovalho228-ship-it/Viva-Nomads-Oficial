import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T142 — ordem 7000fbe0 (telas 5–6): página de bairro e grade de bairros da cidade.
 *  O imóvel do laboratório fica no bairro "Centro": o cartão do bairro aparece em
 *  /cidades/uberlandia com contagem real, a página /cidades/uberlandia/centro mostra resumo,
 *  mapa de área aproximada, anúncio, FAQ e JSON-LD sem coordenada; bairro sem anúncio dá 404.
 *  Larguras 390 e 1280 px, sem rolagem lateral.
 */
const senha = novaSenha();
const dono = { email: `dono.bairro.${novoSufixo()}@lab.vivanomads.test`, nome: "Bia Bairro", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T142 — Bairros", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, "Studio do bairro de teste", { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px: grade da cidade e página do bairro`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/cidades/uberlandia", { waitUntil: "networkidle" });
      const grade = page.getByTestId("bairros-grade");
      await expect(grade).toBeVisible();
      const centro = grade.getByTestId("bairro-cartao").filter({ hasText: "Centro" });
      await expect(centro).toHaveCount(1);
      await expect(centro).toContainText(/\d+ imóve(l|is)/);
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);

      await centro.click();
      await expect(page).toHaveURL(/\/cidades\/uberlandia\/centro$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Imóveis mobiliados em Centro");
      await expect(page.getByTestId("bairro-resumo")).toContainText("imóvel mobiliado publicado");
      await expect(page.getByTestId("bairro-mapa")).toBeVisible();
      await expect(page.getByTestId("bairro-anuncios")).toContainText("Studio do bairro de teste");
      await expect(page.getByTestId("bairro-faq")).toBeVisible();
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    });
  }

  test("HTML sem JavaScript: título, JSON-LD sem coordenada e sem termos proibidos; bairro sem anúncio dá 404", async ({ request }) => {
    const r = await request.get("/cidades/uberlandia/centro");
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toContain("Imóveis mobiliados em Centro");
    expect(html).toMatch(/"@type":"FAQPage"/);
    expect(html).toMatch(/"@type":"BreadcrumbList"/);
    expect(html).not.toMatch(/"(latitude|longitude|geo)"/);
    expect(html).not.toMatch(/temporada|vistoria|comiss[aã]o/i);
    expect((await request.get("/cidades/uberlandia/bairro-que-nao-existe-xyz")).status()).toBe(404);
  });

  test("sitemap lista o bairro", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/cidades/uberlandia/centro");
  });
});
