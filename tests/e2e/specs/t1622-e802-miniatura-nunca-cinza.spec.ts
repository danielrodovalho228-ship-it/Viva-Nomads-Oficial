import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, entrarNaPagina } from "../fixtures/laboratorio";

/*
  T1622 — E802 (D6, prova de 12/11): em /dashboard/imoveis a miniatura do anúncio virava caixa cinza e nunca renderizava. O
  BrandImage só saía de "carregando" pelos eventos onLoad/onError do React; quando a imagem termina (ou falha) ANTES da
  hidratação, o evento já passou e o quadro fica cinza para sempre. Regra: toda miniatura termina num estado conferível —
  "pronta" (a foto de verdade carregou: naturalWidth > 0) ou "falhou" ("Foto indisponível") —, nunca "carregando" parada.
  Conta da massa da varredura com fotos (DONO17: 2 ativos e 1 rascunho com foto). 1280 e 390.
*/
const DONO = { email: process.env.TESTES_VARREDURA_DONO17_EMAIL, senha: process.env.TESTES_VARREDURA_DONO17_SENHA };

async function entrar(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 768 ? 844 : 900 } });
  const page = await ctx.newPage();
  await entrarNaPagina(page, DONO.email!, DONO.senha!);
  return page;
}

const estados = (page: Page) =>
  page.locator('[data-testid="meu-anuncio-foto"] [data-foto-estado]').evaluateAll((els) =>
    els.map((el) => ({ estado: el.getAttribute("data-foto-estado"), largura: (el.querySelector("img") as HTMLImageElement | null)?.naturalWidth ?? 0 })),
  );

test.describe("T1622 — E802 miniatura de anúncio nunca fica cinza", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!DONO.email || !DONO.senha, "conta da massa ausente (rode scripts/lab/massa-varredura.mjs)");

  for (const largura of [1280, 390]) {
    test(`${largura}px — foto que falha antes da hidratação vira "Foto indisponível", nunca caixa cinza`, async ({ browser }) => {
      const page = await entrar(browser, largura);
      // A foto falha na hora (antes do JS da página hidratar): pelo otimizador e direto da origem.
      await page.route(/\/_next\/image\?|\/storage\/v1\/object\/public\/property-photos\//, (r) => r.abort());
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="meu-anuncio-foto"]').first()).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(async () => (await estados(page)).filter((e) => e.estado === "carregando").length, { timeout: 8_000, message: "miniatura parada em 'carregando' (caixa cinza)" })
        .toBe(0);
      const fim = await estados(page);
      expect(fim.length, "há miniaturas com foto na tela").toBeGreaterThan(0);
      expect(fim.every((e) => e.estado === "falhou"), `estados: ${JSON.stringify(fim)}`).toBe(true);
      await expect(page.getByTestId("foto-indisponivel").first()).toBeVisible();
      await page.context().close();
    });

    test(`${largura}px — carga normal: toda miniatura com foto termina "pronta", com a imagem de verdade`, async ({ browser }) => {
      const page = await entrar(browser, largura);
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="meu-anuncio-foto"]').first()).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(async () => (await estados(page)).filter((e) => e.estado === "carregando").length, { timeout: 15_000, message: "miniatura parada em 'carregando' (caixa cinza)" })
        .toBe(0);
      const fim = await estados(page);
      expect(fim.length).toBeGreaterThan(0);
      expect(fim.every((e) => e.estado === "pronta" && e.largura > 0), `estados: ${JSON.stringify(fim)}`).toBe(true);
      await page.context().close();
    });
  }
});
