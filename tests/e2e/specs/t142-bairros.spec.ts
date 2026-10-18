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
      // A página do bairro compila na primeira visita no servidor frio do laboratório: dá folga (instável em todas as execuções).
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
      const grade = page.getByTestId("bairros-grade");
      await expect(grade).toBeVisible();
      const centro = grade.getByTestId("bairro-cartao").filter({ hasText: "Centro" });
      await expect(centro).toHaveCount(1);
      await expect(centro).toContainText(/\d+ imóve(l|is)/);
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);

      await centro.click();
      await expect(page).toHaveURL(/\/cidades\/uberlandia\/centro$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Imóveis mobiliados em Centro", { timeout: 30_000 });
      await expect(page.getByTestId("bairro-resumo")).toContainText(/imóve(l|is) mobiliados? publicados?/);
      await expect(page.getByTestId("bairro-mapa")).toBeVisible();
      await expect(page.getByTestId("bairro-anuncios")).toContainText("Studio do bairro de teste");
      await expect(page.getByTestId("bairro-faq")).toBeVisible();
      await expect(page.getByTestId("bairro-faq")).toContainText("Sim.");
      await expect(page.getByTestId("bairro-ver-cidade")).toBeVisible();
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

  for (const largura of [390, 1280]) {
    test(`${largura} px: grade tem os 3 bairros aprovados e Martins vazio é honesto e noindex`, async ({ page, request }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
      for (const nome of ["Umuarama", "Santa Mônica", "Martins"]) {
        await expect(page.getByTestId("bairros-grade").getByTestId("bairro-cartao").filter({ hasText: nome })).toHaveCount(1);
      }
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);

      // Martins não tem anúncio real no laboratório: 200, estado vazio, noindex e fora do sitemap.
      const r = await request.get("/cidades/uberlandia/martins");
      expect(r.status()).toBe(200);
      expect(await r.text()).toMatch(/name="robots" content="noindex/);
      await page.goto("/cidades/uberlandia/martins", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("bairro-vazio")).toContainText("Ainda não há imóveis mobiliados publicados no Martins");
      await expect(page.getByTestId("bairro-vazio").getByTestId("salvar-busca")).toContainText("Avise-me quando houver");
      await expect(page.getByTestId("bairro-vizinhos")).toContainText("Centro");
      // Saída para os imóveis da cidade, com a contagem real, e FAQ sem afirmar anúncio.
      const ver = page.getByTestId("bairro-vazio").getByTestId("bairro-ver-cidade");
      await expect(ver).toContainText(/Ver (todos os \d+ imóve(l|is)|todos os imóveis) em Uberlândia/);
      await expect(page.getByTestId("bairro-faq")).toContainText("Ainda não há imóveis mobiliados publicados em Martins");
      await expect(page.getByTestId("bairro-faq")).not.toContainText(/^Sim\./m);
      await ver.click();
      await expect(page).toHaveURL(/\/buscar\?local=Uberl/);
      await page.goBack();
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
      const xml = await (await request.get("/sitemap.xml")).text();
      expect(xml).not.toContain("/cidades/uberlandia/martins");
    });
  }

  test("/bairros/martins redireciona para a página do bairro; Umuarama e Santa Mônica abrem sem 404", async ({ request }) => {
    const r = await request.get("/bairros/martins", { maxRedirects: 0 });
    expect([301, 308]).toContain(r.status());
    expect(r.headers()["location"]).toContain("/cidades/uberlandia/martins");
    for (const slug of ["umuarama", "santa-monica"]) {
      expect((await request.get(`/cidades/uberlandia/${slug}`)).status()).toBe(200);
    }
  });

  test("sitemap lista o bairro", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/cidades/uberlandia/centro");
  });
});
