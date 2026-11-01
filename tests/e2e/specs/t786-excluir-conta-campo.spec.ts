import { test, expect } from "@playwright/test";

/*
  T786 — varredura 01/11 (Pista A): /excluir-conta — o campo de e-mail tem alvo de toque de pelo menos 44 px, 16 px de
  fonte no celular (sem zoom do iPhone) e o erro "Digite um e-mail válido." é anunciado (role=alert) e ligado ao campo.
  390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T786 — /excluir-conta: campo de e-mail acessível (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/excluir-conta", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("excluir-conta-email");
    await expect(campo).toBeVisible();
    const caixa = await campo.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    const fonte = await campo.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(fonte).toBeGreaterThanOrEqual(largura === 390 ? 16 : 14);

    // "a@b" passa na validação nativa e cai na nossa: erro anunciado e ligado ao campo.
    // Antes da hidratação o clique enviaria o formulário nativo (recarga): repete até o React responder.
    const erro = page.getByRole("alert").filter({ hasText: "Digite um e-mail válido." });
    await expect(async () => {
      await campo.fill("a@b");
      await page.getByRole("button", { name: "Enviar link de exclusão" }).click();
      await expect(erro).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAttribute("aria-describedby", "email-exclusao-erro");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${SAIDA}/t786-excluir-conta-${largura}.png` });
  });
}
