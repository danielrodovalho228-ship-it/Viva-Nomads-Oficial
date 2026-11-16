import { test, expect } from "@playwright/test";

/*
  T2069 — E976 (Pista 3; autorizado pelo Gerente na ronda 03:20Z; família do E949) @E976 @ao-vivo-seguro
  Regra decidida (WCAG 2.4.1): o link "Pular para o conteúdo principal" é o PRIMEIRO focável da página — o primeiro Tab
  cai nele. O botão flutuante "Fale com a Viva" não pode receber o primeiro Tab (hoje, a 1280 px, recebe). O botão
  continua na página a 1280 px (a correção não o tira; no celular ele não aparece). Superfícies: /parceiros e uma irmã com o mesmo botão (a home, /).
  Trava: vermelha na main até a correção (sessão fable) entrar. Visitante, só leitura. 390 e 1280 px.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const rota of ["/parceiros", "/"]) {
  for (const largura of [390, 1280]) {
    test(`T2069 — E976: em ${rota} a ${largura} px o primeiro Tab cai no salto para o conteúdo @E976 @ao-vivo-seguro`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(page.locator("main#conteudo")).toBeVisible({ timeout: 30_000 });
      // A 1280 px o botão flutuante existe (no celular ele não aparece): a correção não o tira da página.
      if (largura >= 1024) await expect(page.getByRole("button", { name: "Fale com a Viva" }).first(), "o botão flutuante segue na página").toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("load");

      await page.keyboard.press("Tab");
      const primeiro = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return { tag: a?.tagName.toLowerCase(), texto: (a?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60) };
      });
      expect(primeiro.texto, `o primeiro Tab caiu em <${primeiro.tag}> "${primeiro.texto}"`).toBe("Pular para o conteúdo principal");
      await expect(page.getByRole("link", { name: "Pular para o conteúdo principal" })).toBeFocused();
    });
  }
}
