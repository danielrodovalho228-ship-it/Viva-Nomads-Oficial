import { test, expect } from "@playwright/test";

/*
  T1489 — T-janelas-busca, proposto pela QA (rodada 06:40, provado ao vivo na 07:05): em /buscar, a 390 e 1280 px, cada controle da faixa
  (Datas, Local, Tipo, Preço, Nível quando existe, Ordenar) abre a sua janela SEM rolagem lateral, com o botão "Fechar" ao alcance
  (scrollIntoViewIfNeeded + clique fecha); o Esc também fecha e o foco volta ao botão que abriu. "Mais filtros" abre a folha (dialog) e fecha
  pelo botão; o foco ao fechar pelo Esc é o C17 (t1486), não daqui. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const CONTROLES = ["datas", "local", "tipo", "preco", "nivel", "ordenar"] as const;

test.describe("T1489 — janelas da busca", () => {
  for (const w of [390, 1280] as const) {
    test(`a ${w} px: cada controle abre a janela sem rolagem lateral; Fechar e Esc fecham`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: w, height: 844 });
      const r = await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByTestId("linha-pilulas")).toBeVisible({ timeout: 30_000 });
      let abertos = 0;
      for (const id of CONTROLES) {
        const botao = page.getByTestId(`pilula-${id}`);
        if ((await botao.count()) === 0) continue; // o Nível só existe quando há nível para escolher (E452)
        abertos++;
        const janela = page.getByTestId(`painel-pilula-${id}`);

        await botao.scrollIntoViewIfNeeded();
        await botao.click();
        await expect(janela, `${id}: abre`).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${id}: rolagem lateral`).toBeLessThanOrEqual(1);
        const fechar = janela.getByRole("button", { name: "Fechar" });
        await fechar.scrollIntoViewIfNeeded();
        await expect(fechar, `${id}: Fechar ao alcance`).toBeVisible();
        await fechar.click();
        await expect(janela, `${id}: Fechar fecha`).toHaveCount(0);

        await botao.click();
        await expect(janela).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(janela, `${id}: Esc fecha`).toHaveCount(0);
        expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? ""), `${id}: o foco volta ao botão`).toBe(`pilula-${id}`);
      }
      expect(abertos, "ao menos Datas, Local, Tipo, Preço e Ordenar").toBeGreaterThanOrEqual(5);

      await page.getByTestId("pilula-mais").click();
      const folha = page.getByRole("dialog");
      await expect(folha).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "Mais filtros: rolagem lateral").toBeLessThanOrEqual(1);
      await folha.getByRole("button", { name: /Mostrar|Fechar/ }).first().scrollIntoViewIfNeeded();
    });
  }
});
