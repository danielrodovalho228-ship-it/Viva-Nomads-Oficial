import { test, expect } from "@playwright/test";

/*
  T1602 — E791: /parceiros diz o prazo de resposta ao pedido de parceria (o mesmo do formulário depois de enviar e do
  alerta da equipe: 1 dia útil). O prazo de /empresas (7 dias) é de outro pedido e não aparece aqui. Visitante, 390 e 1280.
*/
for (const w of [390, 1280] as const) {
  test(`${w}: /parceiros mostra 'em até 1 dia útil' no passo da conferência e no Seja parceiro`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("parceiros-prazo-resposta")).toHaveText("A Viva responde por e-mail em até 1 dia útil.");
    await expect(page.getByText(/Identidade e CNPJ; para fotografia, também o portfólio\. A Viva responde por e-mail em até 1 dia útil\./)).toBeVisible();
    await expect(page.locator("main")).not.toContainText("7 dias");
  });
}
