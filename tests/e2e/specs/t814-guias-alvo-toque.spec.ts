import { test, expect } from "@playwright/test";

/*
  T814 — varredura 02/11 (Pista A): os links do fim do guia ("Buscar imóveis mobiliados" e "Anunciar o meu imóvel")
  têm 44 px de altura e não se sobrepõem; sem rolagem lateral. 390 e 1280.
*/
for (const largura of [390, 1280] as const) {
  test(`T814 — links do fim do guia com 44 px (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/guias/o-que-e-a-caucao", { waitUntil: "domcontentloaded" });
    const buscar = page.getByTestId("guia-cta-buscar");
    const anunciar = page.getByTestId("guia-cta-anunciar");
    await expect(buscar).toBeVisible({ timeout: 30_000 });
    const a = (await buscar.boundingBox())!;
    const b = (await anunciar.boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    const sobrepoe = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(sobrepoe).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await buscar.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tests/laboratorio/saida/t814-guia-${largura}.png` });
  });
}
