import { test, expect } from "@playwright/test";

/*
  T2156 — E884 @E884: na busca da home, Esc fecha a lista de sugestões de cidade/bairro.
  Regra decidida (E884; correção e unitário no #3807: src/components/city-autocomplete.tsx fecha a lista no Esc, e
  src/lib/busca/sugestoes-teclado.ts diz que só o Esc muda o estado; unitário src/lib/busca/sugestoes-teclado.test.ts).
  Antes, a lista ficava aberta por cima da página e o Esc não fazia nada. Visitante, só leitura: a home, a 1280 e a 390 px.
  O foco no campo "Para onde você vai?" (#busca-principal-local) abre as sugestões; o Esc fecha-as, e o campo continua
  com o foco e com o texto que tinha (o Esc não apaga nem escolhe nada).
  Trava: vermelha na main até o #3807 entrar; verde com ele.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2156 — E884: Esc fecha as sugestões da busca da home @E884", () => {
  for (const largura of [1280, 390] as const) {
    test(`${largura} px — com as sugestões abertas, Esc fecha a lista e o campo fica com o foco e o texto`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const campo = page.locator("#busca-principal-local");
      await expect(campo).toBeVisible({ timeout: 30_000 });
      // A lista de sugestões é o <ul> dentro da caixa do campo. A caixa é marcada (atributo só do teste) quando a lista abre:
      // depois do Esc, "o ancestral mais próximo com <ul>" já seria outro bloco da home, com outras listas.
      const caixaMarcada = page.locator('[data-t2156="caixa"]');
      const lista = caixaMarcada.locator("ul");

      // O componente só reage depois da hidratação: foca e digita até a lista abrir.
      await expect(async () => {
        await campo.fill("");
        await campo.click();
        await campo.pressSequentially("U");
        // Só o <ul> flutuante das sugestões (classe top-full do CityAutocomplete) conta; outro <ul> da home nunca é marcado.
        const caixa = campo.locator("xpath=ancestor::*[.//ul[contains(concat(' ', normalize-space(@class), ' '), ' top-full ')]][1]");
        await expect(caixa.locator("ul.top-full").first()).toBeVisible({ timeout: 2_000 });
        await caixa.evaluate((el) => el.setAttribute("data-t2156", "caixa"));
        await expect(lista.first()).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      const texto = await campo.inputValue();

      await page.keyboard.press("Escape");
      await expect(lista, "Esc fecha a lista de sugestões").toHaveCount(0);
      await expect(campo, "o campo continua com o foco").toBeFocused();
      await expect(campo, "o Esc não apaga nem escolhe nada").toHaveValue(texto);
    });
  }
});
