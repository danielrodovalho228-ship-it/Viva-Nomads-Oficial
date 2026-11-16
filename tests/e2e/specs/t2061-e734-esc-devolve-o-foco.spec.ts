import { test, expect } from "@playwright/test";

/*
  T2061 — E734 (Pista 3; autorizado pelo Gerente em 17/11) @E734 @ao-vivo-seguro
  Regra (WCAG 2.4.3, decidida no #3533): em /buscar, quem abre "Mais filtros" pelo teclado e fecha a folha com Esc
  volta com o foco no próprio botão "Mais filtros" — não no topo da página nem no <body>. Defeito aberto, sem correção
  na main: esta spec é a trava (vermelha até a correção entrar). Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280]) {
  test(`T2061 — E734: a ${largura} px, Esc fecha Mais filtros e o foco volta ao botão que abriu @E734 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura >= 1024 ? 900 : 800 });
    const r = await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const botao = page.getByTestId("pilula-mais").first();
    await expect(botao).toBeVisible({ timeout: 30_000 });
    const folha = page.getByRole("dialog", { name: "Filtros" });

    // Abre pelo teclado (o caminho de quem não usa o rato). Repete até a página hidratar e a folha abrir.
    await expect(async () => {
      await botao.focus();
      await page.keyboard.press("Enter");
      await expect(folha).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await page.keyboard.press("Escape");
    await expect(folha).toBeHidden();
    await expect(botao, "o foco volta ao botão \"Mais filtros\"").toBeFocused();
  });
}
