import { test, expect } from "@playwright/test";

/*
  T918 — E452 (rodada pública, 02/11; resposta do Muse, 05/11): "Nível" era um beco sem saída (painel só com texto e
  "Fechar"). Regra: ou o filtro oferece os níveis, ou não aparece como filtro. A pílula "Nível" só está na barra quando o
  resultado atual tem nível; sem nenhum, ela não aparece (e nunca há painel só com texto). Com ela, o painel traz as 3
  opções com contagem do resultado e pelo menos uma selecionável. 390 e 1280. Usa os anúncios do ambiente (qualquer base).
*/
for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test.describe(`T918 — E452 a ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: altura });
    });

    test("a pílula Nível nunca abre um painel sem opção selecionável", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await expect(page.getByTestId("linha-pilulas")).toBeVisible();
      const pilula = page.getByTestId("pilula-nivel");
      if ((await pilula.count()) === 0) {
        // Resultado sem nível: nada de filtro que não filtra.
        await expect(page.getByTestId("painel-pilula-nivel")).toHaveCount(0);
        return;
      }
      await pilula.click();
      const painel = page.getByTestId("painel-pilula-nivel");
      await expect(painel).toBeVisible();
      await expect(painel.locator('button[data-testid^="pilula-nivel-"]')).toHaveCount(3);
      for (const v of ["essencial", "conforto", "premium"]) await expect(painel.getByTestId(`pilula-nivel-${v}-n`)).toHaveText(/·\s*\d+/);
      const selecionaveis = painel.locator('button[data-testid^="pilula-nivel-"]:not([disabled])');
      expect(await selecionaveis.count(), "ao menos uma opção selecionável").toBeGreaterThan(0);
      await selecionaveis.first().click();
      await expect(page).toHaveURL(/nivel=/);
      await expect(pilula).not.toHaveAttribute("data-valor", "");
      await page.screenshot({ path: `tests/laboratorio/saida/t918-e452-${largura}.png` });
    });

    test("busca sem nenhum anúncio: a pílula Nível não aparece", async ({ page }) => {
      await page.goto("/buscar?local=Manaus", { waitUntil: "networkidle" });
      await expect(page.getByTestId("linha-pilulas")).toBeVisible();
      await expect(page.getByTestId("pilula-nivel")).toHaveCount(0);
      await expect(page.getByTestId("painel-pilula-nivel")).toHaveCount(0);
    });

    test("?nivel= que zerou a busca: a pílula fica (ativa) para desligar o filtro", async ({ page }) => {
      await page.goto("/buscar?nivel=premium", { waitUntil: "networkidle" });
      await expect(page.getByTestId("pilula-nivel")).toHaveAttribute("data-valor", /.+/);
    });
  });
}
