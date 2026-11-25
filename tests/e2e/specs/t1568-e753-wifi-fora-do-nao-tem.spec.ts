import { test, expect } from "@playwright/test";

/*
  T1568 — E753 (#3555): "Wi-Fi" não aparece em "Não tem" quando o anúncio afirma internet (categoria de uso informada, "Internet para
  trabalho remoto…"). Em /imoveis/ube-003 (exemplo sem item de internet nas comodidades, com internet declarada) a lista "Não tem" traz as
  outras faltas esperadas e nunca Wi-Fi; a página continua afirmando a internet. 390 e 1280 px, sem estouro. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const [w, h] of [[390, 844], [1280, 900]] as const) {
  test(`a ${w} px: ube-003 não lista Wi-Fi em "Não tem" e segue afirmando a internet`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/imoveis/ube-003", { waitUntil: "domcontentloaded" });
    const naoTem = page.getByTestId("comodidades-nao-tem");
    await expect(naoTem).toBeVisible({ timeout: 30_000 });
    const itens = await page.getByTestId("comodidade-nao-tem-item").allInnerTexts();
    expect(itens.length, "a lista 'Não tem' continua existindo").toBeGreaterThan(0);
    expect(itens.join("|"), `Não tem: ${itens.join(", ")}`).not.toMatch(/wi-?fi|internet/i);
    // a página afirma internet em algum lugar (o anúncio não nega o que afirma)
    await expect(page.getByText(/internet/i).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "rolagem lateral").toBeLessThanOrEqual(0);
  });
}
