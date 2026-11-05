import { test, expect } from "@playwright/test";
import { GESTOR_PRECO } from "../../../src/config/planos";

/*
  T866 — E578 (chat principal, 04/11): o bloco "Para proprietários" da home cita o Plano Gestor na faixa da taxa
  (E564: até 6% nas faixas; Gestor 4% a partir de 20 imóveis ou administradora). 390 e 1280 px; sem conta.
*/
const PCT = String(Math.round(GESTOR_PRECO.taxa * 1000) / 10).replace(".", ",");
const ESPERADO = `Quanto mais imóveis, menor a taxa (até 6%; Plano Gestor: ${PCT}% a partir de ${GESTOR_PRECO.minimoImoveis} imóveis ou para administradoras). Sem mensalidade.`;

for (const largura of [1280, 390] as const) {
  test(`T866 — home (${largura}px): a faixa da taxa cita o Plano Gestor`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const bloco = page.locator("section", { hasText: "Mais estabilidade e" }).last();
    await bloco.scrollIntoViewIfNeeded();
    await expect(bloco).toContainText(ESPERADO, { timeout: 30_000 });
    await expect(bloco).not.toContainText("(até 6%).");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
