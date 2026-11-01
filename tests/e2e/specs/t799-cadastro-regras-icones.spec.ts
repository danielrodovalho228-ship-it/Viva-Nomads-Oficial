import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T799 — conformidade do cadastro (Passo 6, mockup 06, 01/11, Pista A): cada regra da casa tem ícone — os cartões
  sim/não e os blocos de convivência. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
test.use({ storageState: authFile("proprietario") });

for (const largura of [390, 1280] as const) {
  test(`T799 — Passo 6 com ícone em cada regra (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/imoveis/novo?etapa=regras", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const grade = page.getByTestId("etapa-regras-casa");
    await expect(grade).toBeVisible({ timeout: 20_000 });
    const cartoes = grade.locator("[data-cartao-assistente]");
    expect(await cartoes.count()).toBeGreaterThanOrEqual(4);
    for (const c of await cartoes.all()) await expect(c.locator("svg").first()).toBeVisible();
    const blocos = page.getByTestId("regras-casa").locator("[data-ligado]");
    for (const b of await blocos.all()) await expect(b.locator("[data-testid$='-icone']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await grade.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t799-passo6-${largura}.png` });
  });
}
