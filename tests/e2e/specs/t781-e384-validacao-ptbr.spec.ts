import { test, expect } from "@playwright/test";

/*
  T781 — E384 (01/11): a validação nativa falava o idioma do navegador ("Please fill out this field.") no fluxo em
  português. Com o navegador em INGLÊS, a mensagem sai em português; um valor válido libera o campo. 390 e 1280.
*/
test.use({ locale: "en-US", storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280] as const) {
  test(`T781 — E384: validação em português num navegador em inglês (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible({ timeout: 30_000 });
    const enviar = page.locator("form").filter({ has: email }).locator('button[type="submit"]').first();
    await expect(async () => {
      await enviar.click();
      expect(await email.evaluate((e: HTMLInputElement) => e.validationMessage)).toBe("Preencha este campo.");
    }).toPass({ timeout: 20_000 });
    await email.fill("abc");
    await enviar.click();
    expect(await email.evaluate((e: HTMLInputElement) => e.validationMessage)).toBe("Informe um e-mail válido (ex.: nome@exemplo.com).");
    await email.fill("pessoa@exemplo.com");
    expect(await email.evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(true);
  });
}
