import { test, expect } from "@playwright/test";

/*
  T1624 — E823: o botão flutuante de chat (o redondo) se identifica em /empresas e /parceiros: rótulo visível
  "Fale com a Viva · chat de atendimento" ao passar o mouse e ao focar pelo teclado; title e nome acessível.
*/
test.use({ viewport: { width: 1280, height: 800 } });

for (const rota of ["/empresas", "/parceiros"]) {
  test(`${rota}: o botão redondo do chat diz o que abre`, async ({ page }) => {
    await page.goto(rota, { waitUntil: "networkidle" });
    const botao = page.getByTestId("fale-com-a-viva");
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute("title", "Fale com a Viva · chat de atendimento");
    await expect(botao).toHaveAccessibleName("Fale com a Viva");
    const rotulo = page.getByTestId("fale-com-a-viva-rotulo");
    await expect(rotulo).toBeHidden();
    await botao.hover();
    await expect(rotulo).toBeVisible();
    await expect(rotulo).toHaveText("Fale com a Viva · chat de atendimento");
    await page.mouse.move(0, 0);
    await expect(rotulo).toBeHidden();
    await botao.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(rotulo).toBeVisible();
  });
}
