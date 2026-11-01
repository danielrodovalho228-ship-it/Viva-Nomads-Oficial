import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T800 — conformidade do cadastro (Passo 4, mockup 04, 01/11, Pista A): "Características do imóvel" sobre o cartão dos
  números e o lembrete "Você pode revisar e editar depois, a qualquer momento." abaixo dele. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("proprietario") });

for (const largura of [390, 1280] as const) {
  test(`T800 — Passo 4 com título e lembrete (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/imoveis/novo?etapa=detalhes", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const cartao = page.getByTestId("cartao-numeros");
    await expect(cartao).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Características do imóvel" })).toBeVisible();
    await expect(page.getByTestId("espaco-editar-depois")).toHaveText("Você pode revisar e editar depois, a qualquer momento.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t800-passo4-${largura}.png` });
  });
}
