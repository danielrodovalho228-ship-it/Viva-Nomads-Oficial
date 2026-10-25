import { test, expect, type Page } from "@playwright/test";

/**
 * T208 — Adendo ao prompt 26 (correção do Daniel, 18/10): a Nômade Drive NÃO EXISTE MAIS. Nenhuma tela pode citá-la
 * como parceira — nem as premissas dos sócios (/simulacao e /roi) nem as páginas públicas. 390 e 1280 px.
 */
const NOME = /n[ôo]made\s*drive/i;

async function entrarComoSocio(page: Page, rota: string) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${rota}$`));
}

test.describe("T208 — nenhuma menção à Nômade Drive", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of [390, 1280]) {
    test(`${largura}px — /simulacao e /roi (premissas dos sócios) sem "Nômade Drive" nem "Carro mensal"`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const rota of ["/simulacao", "/roi"]) {
        await entrarComoSocio(page, rota);
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const html = await page.content();
        expect(html, rota).not.toMatch(NOME);
        expect(html, rota).not.toMatch(/Carro mensal/i);
        await page.screenshot({ path: `tests/laboratorio/saida/t208-${rota.slice(1)}-${largura}.png`, fullPage: false });
      }
    });
  }

  test("páginas públicas e de parceiros sem a menção", async ({ page }) => {
    for (const rota of ["/", "/parceiros", "/precos", "/como-funciona", "/para-proprietarios", "/modelodenegocio", "/decisao"]) {
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      if (r && r.status() >= 400) continue;
      expect(await page.content(), rota).not.toMatch(NOME);
    }
  });
});
