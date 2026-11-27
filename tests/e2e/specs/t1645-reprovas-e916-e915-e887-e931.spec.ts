import { test, expect, type Page } from "@playwright/test";

/**
 * T1645 — re-provas (ORDEM-DUET-019/020), sem login, a 390 px (guarda visual) e a 1280 px:
 *  - E916 a 404 tem a casca completa: cabeçalho padrão com a navegação (Imóveis · Anunciar · Empresas · Parceiros ·
 *    Entrar), a busca e o rodapé.
 *  - E915 /parceiros/buscar?categoria=<inexistente> avisa que a categoria não existe e NÃO arma o "Quero ser avisado".
 *  - E887 /conferir diz o que a conferência mostra e a validade; a Ajuda (Segurança e conta) explica como conferir.
 *  - E931 o "Fale com a Viva" flutuante aparece na /ajuda, na posição padrão (do tablet para cima; no celular ele some
 *    em todas as telas, E246); fica fora da /buscar (E95, regra final da ORDEM-DUET-030) e da página do próprio chat.
 * E917 (validade do código e do link) é texto do passo pós-envio: travado pelo teste unitário E917.
 */
async function semRolagemLateral(page: Page) {
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(largura, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

for (const largura of [390, 1280]) {
  test.describe(`T1645 — re-provas (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: 844 } });

    test("E916: a 404 tem cabeçalho com a navegação, busca e rodapé", async ({ page }) => {
      const r = await page.goto("/pagina-que-nao-existe-e916", { waitUntil: "networkidle" });
      expect(r?.status()).toBe(404);
      const topo = page.getByTestId("topo-publico");
      await expect(topo).toBeVisible();
      if (largura >= 1024) {
        await expect(page.getByTestId("nav-links")).toBeVisible();
        await expect(page.getByTestId("nav-entrar")).toBeVisible();
      } else {
        // O menu ☰ é do Navbar (cliente): repete o toque até a hidratação ligar o botão.
        await expect(async () => {
          await page.getByTestId("nav-menu").click();
          await expect(page.getByTestId("nav-menu-lista")).toBeVisible({ timeout: 1_000 });
        }).toPass({ timeout: 15_000 });
        await expect(page.getByTestId("nav-menu-lista").getByRole("link", { name: "Entrar" })).toBeVisible();
        await page.getByTestId("nav-menu").click();
      }
      await expect(page.getByTestId("nao-encontrada-busca")).toBeVisible();
      await expect(page.locator("footer").last()).toBeVisible();
      await semRolagemLateral(page);
    });

    test("E915: categoria inexistente avisa e não arma o 'Quero ser avisado'", async ({ page }) => {
      await page.goto("/parceiros/buscar?categoria=piscina&cidade=Cidade%20Sem%20Parceiro%20E915&uf=MG", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("busca-parceiros-categoria-inexistente")).toContainText('A categoria "piscina" não existe');
      await expect(page.getByTestId("busca-parceiros-vazia")).toBeVisible();
      await expect(page.getByTestId("aviso-fotografo")).toHaveCount(0);
      await semRolagemLateral(page);
      // Sem categoria ("Todas"): o aviso existe e não fala em "desta categoria".
      await page.goto("/parceiros/buscar?cidade=Cidade%20Sem%20Parceiro%20E915&uf=MG", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("busca-parceiros-categoria-inexistente")).toHaveCount(0);
      await expect(page.getByTestId("aviso-fotografo-apoio")).toHaveText("Avisamos você quando houver um parceiro na sua cidade.");
    });

    test("E887: /conferir diz o que mostra e a validade; a Ajuda explica como conferir", async ({ page }) => {
      await page.goto("/conferir", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("conferir-o-que-mostra");
      await expect(bloco).toContainText("tipo de documento");
      await expect(bloco).toContainText("data de emissão");
      await expect(bloco).toContainText("nomes das partes");
      await expect(page.getByTestId("conferir-validade")).toContainText("o código não vence");
      await semRolagemLateral(page);
      await page.goto("/ajuda/seguranca", { waitUntil: "domcontentloaded" });
      const pergunta = page.getByTestId("ajuda-perguntas").getByRole("button", { name: "Como confiro se um documento da Viva é verdadeiro?" });
      await pergunta.click();
      await expect(page.getByTestId("ajuda-perguntas")).toContainText("o código não vence");
      // E941 (77762a39): além do botão "Conferir um documento", a resposta liga /conferir no próprio texto — são 2 links.
      // A regra é a mesma (a Ajuda leva a /conferir); o localizador aceita os dois e cobra que haja pelo menos um visível.
      const linksConferir = page.getByTestId("ajuda-perguntas").locator('a[href="/conferir"]');
      await expect(linksConferir.first()).toBeVisible();
      expect(await linksConferir.count()).toBeGreaterThanOrEqual(1);
      await semRolagemLateral(page);
    });

    test("E931: o 'Fale com a Viva' flutuante na /ajuda (posição padrão); fora da /buscar e da página do chat", async ({ page }) => {
      for (const rota of ["/ajuda", "/"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("fale-com-a-viva-raiz"), rota).toHaveCount(1);
        const flut = page.getByTestId("fale-com-a-viva");
        if (largura < 768) {
          await expect(flut, `${rota} a ${largura}px (E246)`).toBeHidden();
          continue;
        }
        await expect(flut, rota).toBeVisible();
        const caixa = (await flut.boundingBox())!;
        // Posição padrão: canto inferior direito, a 1,5 rem (24 px) da borda direita.
        expect(Math.round(largura - (caixa.x + caixa.width)), `${rota} à direita`).toBe(24);
        expect(caixa.y + caixa.height, `${rota} embaixo`).toBeGreaterThan(844 - 120);
      }
      for (const rota of ["/buscar", "/ajuda/fale-com-a-viva"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("fale-com-a-viva-raiz"), rota).toHaveCount(0);
      }
    });
  });
}
