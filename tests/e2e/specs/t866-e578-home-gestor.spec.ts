import { test, expect } from "@playwright/test";
import { TEXTO_CARTEIRAS } from "../../../src/config/planos";

/*
  T866 — E578 (chat principal, 04/11): o bloco "Para proprietários" da home traz a faixa da taxa.
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a home não cita mais o Plano Gestor nem 4% — a faixa da taxa
  vai "até 6%" e, depois de "Sem mensalidade.", vem a linha de carteiras (TEXTO_CARTEIRAS, config/planos.ts).
  390 e 1280 px; sem conta.
*/
// 078 (Daniel, 16/11/2026): antes "…(até 6%; Plano Gestor: 4% a partir de 20 imóveis ou para administradoras). Sem mensalidade."
const ESPERADO = `Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade. ${TEXTO_CARTEIRAS}`;

for (const largura of [1280, 390] as const) {
  // 078 (Daniel, 16/11/2026): o título era "a faixa da taxa cita o Plano Gestor".
  test(`T866 — home (${largura}px): a faixa da taxa vai até 6% e traz a linha de carteiras, sem o Plano Gestor`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const bloco = page.locator("section", { hasText: "Mais estabilidade e" }).last();
    await bloco.scrollIntoViewIfNeeded();
    await expect(bloco).toContainText(ESPERADO, { timeout: 30_000 });
    // 078 (Daniel, 16/11/2026): antes cobrava que o "(até 6%)." sozinho NÃO aparecesse (o Gestor vinha dentro do
    // parêntese); agora é o Gestor e os 4% que não podem aparecer.
    await expect(bloco).not.toContainText("(até 6%;");
    await expect(bloco).not.toContainText(/Plano Gestor/i);
    await expect(bloco).not.toContainText(/(?<![\d.,])4\s?%/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
