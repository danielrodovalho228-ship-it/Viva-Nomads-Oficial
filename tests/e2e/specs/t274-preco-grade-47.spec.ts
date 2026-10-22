import { test, expect, type Page } from "@playwright/test";

/*
  T274 — Prompt 47 (P1: grade de 4 px, ícones únicos, preço com contexto), a 390 e 1280 px:
  1. Preço com contexto: o cartão da busca mostra "R$ X/mês", o total do período ("R$ Y em N meses") e a
     disponibilidade; a página do imóvel (cartão lateral no computador, rodapé fixo no celular) repete EXATAMENTE os
     mesmos textos para a mesma duração.
  2. Emoji fora da interface: home, busca e página do imóvel sem nenhum emoji no texto da tela.
  3. Margem de tela constante: 16 px no celular e 32 px no computador (contêiner da página do imóvel).
*/
const SAIDA = "tests/laboratorio/saida";
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}]/u;
const limpo = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

for (const largura of [390, 1280] as const) {
  test.describe(`T274 — ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("preço com contexto: cartão = página do imóvel (mês, período e disponibilidade)", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("cartao-imovel").filter({ has: page.getByTestId("cartao-total-mes") }).first();
      await expect(cartao.getByTestId("cartao-total-mes")).toBeVisible({ timeout: 30_000 });
      const precoCartao = limpo(await cartao.getByTestId("cartao-total-mes").innerText());
      expect(precoCartao).toMatch(/^R\$ [\d.]+\/mês( · R\$ [\d.]+ em \d+ meses)?$/);
      await expect(cartao.getByTestId("cartao-disponivel")).toHaveText(/^Disponível (agora|a partir de \d{2}\/\d{2}(\/\d{4})?)$/);
      await page.screenshot({ path: `${SAIDA}/t274-busca-${largura}.png`, fullPage: false });

      const href = await cartao.locator('a[href^="/imoveis/"]').first().getAttribute("href");
      expect(href).toBeTruthy();
      await page.goto(href!, { waitUntil: "domcontentloaded" });
      if (largura === 1280) {
        const lateral = page.getByTestId("cartao-lateral-preco");
        await expect(lateral).toBeVisible({ timeout: 30_000 });
        expect(limpo(await lateral.innerText())).toContain(precoCartao.split(" · ")[0]);
        if (precoCartao.includes(" em ")) expect(limpo(await lateral.innerText())).toContain(precoCartao.split(" · ")[1]);
      } else {
        const barra = page.getByTestId("barra-fixa-imovel");
        await expect(barra).toBeVisible({ timeout: 30_000 });
        const total = limpo(await barra.getByTestId("barra-total").innerText());
        expect(total).toContain(precoCartao.split(" · ")[0]);
        if (precoCartao.includes(" em ")) expect(total).toContain(precoCartao.split(" · ")[1]);
      }
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t274-imovel-${largura}.png`, fullPage: false });
    });

    test("interface sem emoji (home, busca e página do imóvel)", async ({ page }) => {
      test.setTimeout(120_000);
      for (const rota of ["/", "/buscar?exemplos=1", "/imoveis/ube-001"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
        const texto = await page.locator("body").innerText();
        const achado = texto.match(EMOJI);
        expect(achado, `${rota}: emoji na tela`).toBeNull();
      }
    });

    test("margem de tela constante: 16 px no celular, 32 px no computador", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const caixa = page.getByTestId("imovel-largura-total");
      await expect(caixa).toBeVisible({ timeout: 30_000 });
      const pad = await caixa.evaluate((el) => getComputedStyle(el).paddingLeft);
      expect(pad).toBe(largura === 390 ? "16px" : "32px");
      await semRolagemLateral(page);
    });
  });
}
