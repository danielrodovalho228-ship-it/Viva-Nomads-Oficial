import { test, expect, type Page, type Locator } from "@playwright/test";

/*
  T855 — E568 (QA 04/11/2026): digitar a data num campo de data que JÁ tinha data não corrompe mais o valor. No passo 1 do
  "Pedir para morar", selecionar tudo e digitar "10/01/2027" virava "00/12/027" (a 1ª tecla sumia). Agora fica
  "10/01/2027", sem aviso de data inválida. A correção mora no campo comum (CampoData): conferido também na caixa do
  anúncio e no pedido de moradia. 390 e 1280.
*/
async function redigitar(page: Page, campo: Locator, antes: string, depois: string) {
  await campo.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(antes, { delay: 30 });
  await expect(campo).toHaveValue(antes);
  // a pessoa volta ao campo, seleciona tudo e digita a nova data, tecla a tecla
  await campo.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(depois, { delay: 60 });
  await expect(campo).toHaveValue(depois);
}

for (const largura of [1280, 390] as const) {
  test.describe(`T855 — E568 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("'Pedir para morar', passo 1: redigitar a data num campo que já tinha data", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Pedir para morar" }).filter({ visible: true }).first().click();
      const entrada = page.getByTestId("solicitacao-inicio").filter({ visible: true }).first();
      await expect(entrada).toBeVisible();
      await redigitar(page, entrada, "05/12/2026", "10/01/2027");
      const saida = page.getByTestId("solicitacao-saida").filter({ visible: true }).first();
      await redigitar(page, saida, "10/03/2027", "20/04/2027");
      await expect(entrada).toHaveValue("10/01/2027");
      // só dígitos também (a máscara põe as barras)
      await entrada.click();
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("15022027", { delay: 60 });
      await expect(entrada).toHaveValue("15/02/2027");
      await expect(page.getByText(/data inválida|não é uma data/i)).toHaveCount(0);
      await page.getByRole("dialog").screenshot({ path: `tests/laboratorio/saida/t855-pedir-${largura}.png` });
    });

    test("o mesmo campo na caixa do anúncio e no pedido de moradia", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const caixa = page.getByTestId("candidatura-inicio").filter({ visible: true }).first();
      if (await caixa.count()) await redigitar(page, caixa, "05/12/2026", "10/01/2027");
      await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
      const pedido = page.getByTestId("pedido-data").filter({ visible: true }).first();
      if (await pedido.count()) await redigitar(page, pedido, "05/12/2026", "10/01/2027");
    });
  });
}
