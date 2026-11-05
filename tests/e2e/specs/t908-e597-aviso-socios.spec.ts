import { test, expect, type Page } from "@playwright/test";

/*
  T908 — E597 (urgente, 05/11): /socios e /decisao abrem com o aviso fixo no topo, com o texto exato aprovado pelo
  coordenador; ele continua à vista ao rolar. /simulacao não muda (sem o aviso). 390 e 1280, com o código dos sócios.
*/
const TEXTO = "Página em atualização com a decisão de 04/11 (Caminho B). Não usar como referência até a revisão.";
const SAIDA = "tests/laboratorio/saida";

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

for (const w of [1280, 390] as const) {
  test.describe(`T908 — E597: aviso de página em atualização a ${w} px`, () => {
    test.use({ viewport: { width: w, height: w === 390 ? 844 : 900 } });

    for (const rota of ["/socios", "/decisao"]) {
      test(`${rota}: o aviso no topo, com o texto exato, fixo ao rolar`, async ({ page }) => {
        await entrarComoSocio(page, rota);
        const aviso = page.getByTestId("aviso-em-atualizacao");
        await expect(aviso).toBeVisible({ timeout: 30_000 });
        await expect(aviso).toHaveText(TEXTO);
        // No topo: nada visível acima dele.
        expect((await aviso.boundingBox())!.y).toBeLessThanOrEqual(1);
        // Fixo: depois de rolar, continua no topo da tela.
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(300);
        await expect(aviso).toBeInViewport();
        expect((await aviso.boundingBox())!.y).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${SAIDA}/t908${rota.replace("/", "-")}-${w}.png` });
      });
    }

    test("/simulacao não muda (sem o aviso)", async ({ page }) => {
      await entrarComoSocio(page, "/simulacao");
      await expect(page.locator("main, body").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("aviso-em-atualizacao")).toHaveCount(0);
    });
  });
}
