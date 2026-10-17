import { test, expect, type Page } from "@playwright/test";

/*
  T176 — Exemplo ilustrativo completo nos anúncios de exemplo (prompt 9), a 390 e 1280 px.
  1. ube-001: faixa (resposta · calendário · proprietário), estrelas ao lado do título com âncora, seção
     Avaliações com cards, "Ler mais" e resposta, "Escrever avaliação" desabilitado, "Sobre o proprietário".
     Tudo com o selo "Exemplo ilustrativo"; "Enviar mensagem" só abre o aviso de demonstração.
  2. "Ver perfil completo" abre /proprietario/exemplo-1 (faixa de exemplo, noindex, imóveis e avaliações).
  3. Nenhum JSON-LD de Review/AggregateRating no exemplo; o perfil de exemplo fica fora do sitemap.
  4. QA do Moacir: /cidades/xpto123, /imoveis/<id inexistente> e /proprietario/<id inexistente> dão 404,
     com título e h1 "Página não encontrada" e noindex.
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T176 — proprietário e avaliações de exemplo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — ube-001: faixa, estrelas, avaliações e Sobre o proprietário, tudo marcado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });

      const faixa = page.getByTestId("faixa-proprietario");
      await expect(faixa.getByTestId("selo-exemplo")).toHaveText("Exemplo ilustrativo");
      await expect(faixa.getByTestId("faixa-resposta")).toHaveText(/^Costuma responder em até \d+ horas?$/);
      await expect(faixa.getByTestId("faixa-calendario")).toHaveText("Atualizado nos últimos 30 dias");
      await expect(faixa.getByTestId("faixa-nome")).toHaveText(/\(exemplo\)$/);
      await expect(faixa).toContainText(/Na Viva há \d+/);
      await page.screenshot({ path: `${SAIDA}/t176-faixa-${largura}.png`, fullPage: false });

      const estrelas = page.getByTestId("estrelas-titulo");
      await expect(estrelas).toHaveText(/^\d,\d · [23] avaliações$/);
      await expect(estrelas).toHaveAttribute("href", "#avaliacoes");

      const secao = page.getByTestId("avaliacoes-exemplo");
      await expect(secao.getByTestId("selo-exemplo")).toHaveText("Exemplo ilustrativo");
      await expect(secao).toContainText("nos anúncios reais estes dados vêm do perfil e das estadias verificadas");
      const cards = secao.getByTestId("avaliacao-exemplo");
      expect(await cards.count()).toBeGreaterThanOrEqual(2);
      await expect(secao.getByTestId("avaliacao-resposta").first()).toContainText("Resposta do proprietário");
      const lerMais = secao.getByRole("button", { name: "Ler mais" }).first();
      await lerMais.click();
      await expect(secao.getByRole("button", { name: "Ler menos" }).first()).toBeVisible();
      await expect(secao.getByRole("button", { name: "Escrever avaliação" })).toBeDisabled();
      await expect(secao).toContainText("Disponível após uma estadia verificada.");
      await secao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t176-avaliacoes-${largura}.png`, fullPage: false });

      const dono = page.getByTestId("sobre-proprietario");
      await expect(dono.getByTestId("selo-exemplo")).toHaveText("Exemplo ilustrativo");
      await expect(dono.getByTestId("proprietario-selos")).toContainText("E-mail confirmado");
      await expect(dono.getByTestId("proprietario-tempo")).toBeVisible();
      await expect(dono).not.toContainText(/Ligar|\(\d{2}\)\s?9?\d{4}-?\d{4}/);
      await dono.getByRole("button", { name: "Enviar mensagem" }).click();
      await expect(dono.getByTestId("mensagem-demo")).toContainText("nenhuma mensagem é enviada");
      await dono.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t176-sobre-proprietario-${largura}.png`, fullPage: false });

      // Avaliação ilustrativa nunca vai para o Google.
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ld.join("\n")).not.toMatch(/"(Review|AggregateRating)"/);
      await semRolagemLateral(page);

      await dono.getByRole("link", { name: "Ver perfil completo" }).click();
      await expect(page).toHaveURL(/\/proprietario\/exemplo-1$/);
      const perfil = page.getByTestId("pagina-proprietario");
      await expect(perfil.getByTestId("faixa-exemplo")).toContainText("Exemplo ilustrativo");
      await expect(perfil.getByRole("heading", { level: 1 })).toHaveText(/\(exemplo\)$/);
      await expect(perfil.getByTestId("avaliacao-exemplo").first()).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t176-perfil-exemplo-${largura}.png`, fullPage: true });
    });
  }

  test("sitemap: sem perfil de exemplo nem anúncio de exemplo", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toMatch(/\/proprietario\/exemplo-/);
    expect(xml).not.toMatch(/\/imoveis\/ube-\d{3}/);
  });

  for (const [rota, nome] of [
    ["/cidades/xpto123", "cidade fora da lista"],
    ["/imoveis/00000000-0000-4000-8000-000000000000", "imóvel inexistente"],
    ["/proprietario/00000000-0000-4000-8000-000000000000", "proprietário inexistente"],
  ] as const) {
    test(`404 de verdade: ${nome}`, async ({ page }) => {
      const res = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(404);
      await expect(page).toHaveTitle(/^Página não encontrada/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    });
  }

  test("cidade liberada continua no ar e indexável", async ({ page }) => {
    const res = await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
  });
});
