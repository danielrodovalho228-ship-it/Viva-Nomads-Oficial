import { test, expect } from "@playwright/test";

/*
  T789 — varredura 01/11 (Pista A): no chat da Viva (/ajuda/fale-com-a-viva), "Falar com uma pessoa", "Central de Ajuda"
  e a caixa de texto têm pelo menos 44 px de altura. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T789 — chat da Viva com alvos de 44 px (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("viva-chat-bloco");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    const alvos = [
      bloco.getByRole("button", { name: "Falar com uma pessoa" }),
      bloco.getByRole("link", { name: "Central de Ajuda" }),
      bloco.getByPlaceholder("Escreva sua dúvida…"),
    ];
    for (const alvo of alvos) {
      await alvo.scrollIntoViewIfNeeded();
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t789-chat-viva-${largura}.png` });
  });
}
