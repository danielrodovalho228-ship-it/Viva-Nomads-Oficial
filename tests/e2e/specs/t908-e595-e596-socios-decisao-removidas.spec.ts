import { test, expect, type Page } from "@playwright/test";

/*
  T908 — E595/E596 parte (a), ordem do Daniel 05/11 (substitui a prova do aviso do E597): /decisao (modelo revogado) e
  /socios (sócios e desenho revogados) foram ELIMINADAS. Acesso direto (e subcaminhos) redireciona para a área interna
  válida — /modelodenegocio, que segue atrás da porta dos sócios — e nunca mostra o conteúdo velho. O menu do documento
  interno fica com Modelo de negócio, Simulação e ROI. 390 e 1280. Com o código dos sócios do laboratório (sem ele, a
  parte de dentro se pula; o redirecionamento sem código roda sempre).
*/
const ROTAS = ["/socios", "/decisao", "/socios/qualquer", "/decisao/qualquer"];
const VELHO = /Gestor a 0%|3 sócios|Rômulo|Danilo|Rogério|híbrido × tradicional|Regra antiga \(1º mês\)/;

async function entrarComoSocio(page: Page) {
  const codigo = process.env.SOCIOS_ACCESS_CODE;
  test.skip(!codigo, "SOCIOS_ACCESS_CODE não definido neste ambiente");
  await page.goto("/acesso-socios?next=%2Fmodelodenegocio", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="codigo"]').fill(codigo!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/modelodenegocio$/);
}

test.describe("T908 — E595/E596: /socios e /decisao eliminadas", () => {
  for (const rota of ROTAS) {
    test(`sem código: ${rota} vai para /modelodenegocio (e dali para a porta), nunca abre`, async ({ request }) => {
      const r = await request.get(rota, { maxRedirects: 0 });
      expect([301, 302, 303, 307, 308]).toContain(r.status());
      expect(new URL(r.headers()["location"] ?? "", "http://x").pathname).toBe("/modelodenegocio");
    });
  }

  for (const w of [1280, 390] as const) {
    test(`com o código, a ${w} px: as duas URLs caem no Modelo de negócio; menu sem Sócios/Decisão`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await entrarComoSocio(page);
      for (const rota of ROTAS) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page, rota).toHaveURL(/\/modelodenegocio$/);
        await expect(page.locator("body"), `${rota}: nada do conteúdo velho`).not.toContainText(VELHO);
      }
      const menu = page.getByRole("navigation", { name: "Documentos internos relacionados" });
      await expect(menu).toBeVisible({ timeout: 30_000 });
      await expect(menu.getByText("Sócios", { exact: true })).toHaveCount(0);
      await expect(menu.getByText("Decisão", { exact: true })).toHaveCount(0);
      await expect(menu.getByRole("link", { name: "Simulação" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "ROI" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t908-e595-${w}.png` });
    });
  }
});
