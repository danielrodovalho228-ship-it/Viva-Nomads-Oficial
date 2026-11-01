import { test, expect, type Page } from "@playwright/test";

/**
 * T967 — E323 (#2097): a foto que falhava no otimizador de imagens (/_next/image — p.ex. tempo esgotado ao gerar AVIF)
 * deixava o quadro em BRANCO até outra recarga. Agora o BrandImage tenta de novo direto da origem (sem otimizar) e, se
 * falhar outra vez, mostra o espaço reservado "Foto indisponível". Pela tela real (/buscar, visitante), 390 e 1280:
 *   1. o otimizador responde 500: as fotos dos cartões caem na tentativa direta (data-tentativa="direta") e CARREGAM
 *      (naturalWidth > 0) — nenhum quadro em branco;
 *   2. o otimizador E a origem (Storage e /images) respondem 500: aparece "Foto indisponível" (foto-indisponivel,
 *      role=img) no lugar da foto — e nenhuma <img> quebrada fica no cartão.
 */
const OTIMIZADOR = "**/_next/image**";
const ORIGENS = ["**/storage/v1/object/**", "**/images/imoveis/**"];

async function falhar(page: Page, padroes: string[]) {
  for (const p of padroes) await page.route(p, (r) => r.fulfill({ status: 500, body: "falha simulada (t967)" }));
}
async function abrirBusca(page: Page) {
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor({ timeout: 30_000 });
  // Rola um pouco para os cartões de baixo pedirem as fotos (lazy).
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(1_500);
  await page.mouse.wheel(0, -1200);
}

for (const largura of [390, 1280] as const) {
  test.describe(`T967 — E323: foto do otimizador que falha nunca fica em branco (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });

    test(`otimizador falhando → a foto vem direto da origem (${largura})`, async ({ page }) => {
      test.setTimeout(90_000);
      await falhar(page, [OTIMIZADOR]);
      await abrirBusca(page);
      const diretas = page.locator('img[data-tentativa="direta"]');
      await expect(diretas.first()).toBeAttached({ timeout: 30_000 });
      await expect
        .poll(() => diretas.first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 30_000 })
        .toBe(true);
      // Nenhuma foto otimizada "presa" quebrada no cartão (ela já trocou para a direta ou para o aviso).
      await page.waitForTimeout(2_000);
      const quebradas = await page.locator('img[data-tentativa="otimizada"]').evaluateAll((l) => l.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length);
      expect(quebradas, "fotos otimizadas quebradas sem nova tentativa").toBe(0);
    });

    test(`otimizador e origem falhando → "Foto indisponível", nunca o branco (${largura})`, async ({ page }) => {
      test.setTimeout(90_000);
      await falhar(page, [OTIMIZADOR, ...ORIGENS]);
      await abrirBusca(page);
      const aviso = page.getByTestId("foto-indisponivel");
      await expect(aviso.first()).toBeVisible({ timeout: 30_000 });
      await expect(aviso.first()).toContainText("Foto indisponível");
      await expect(aviso.first()).toHaveAttribute("role", "img");
      await page.waitForTimeout(2_000);
      const quebradas = await page.locator("img[data-tentativa]").evaluateAll((l) => l.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length);
      expect(quebradas, "fotos quebradas que não viraram 'Foto indisponível'").toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
