import { test, expect, type Page } from "@playwright/test";

/*
  T912 — E457 (rodada pública 02/11): nos painéis de filtro da /buscar, escolher numa lista de escolha única (Tipo, Preço,
  Nível — como o Ordenar) aplica E fecha: a URL e a pílula mostram o filtro e o painel some, sem a pessoa fechar à mão.
  Datas e Local (vários campos) seguem abertos, com o botão de ação "Ver resultados" (antes "Fechar"). 390 e 1280.
*/
async function abrir(page: Page, id: string) {
  const painel = page.getByTestId(`painel-pilula-${id}`);
  await expect(async () => {
    if (!(await painel.isVisible())) await page.getByTestId(`pilula-${id}`).click();
    await expect(painel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return painel;
}

for (const w of [1280, 390] as const) {
  test.describe(`T912 — E457 a ${w} px`, () => {
    test.use({ viewport: { width: w, height: w === 390 ? 844 : 900 } });

    test("Tipo, Preço e Nível: escolheu, aplica e fecha; Datas e Local com 'Ver resultados'", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });

      for (const [id, chave] of [["tipo", "tipo"], ["preco", "preco"], ["nivel", "nivel"]] as const) {
        const painel = await abrir(page, id);
        const opcao = painel.locator(`button[data-testid^="pilula-${id}-"]:not([disabled])`).first();
        if ((await opcao.count()) === 0) {
          await painel.getByTestId("painel-pilula-fechar").click();
          continue; // sem opção com imóvel nesta massa (o painel mostra só zeros)
        }
        await opcao.click();
        await expect(page.getByTestId(`painel-pilula-${id}`), `${id}: fecha ao escolher`).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${chave}=`));
        await expect(page.getByTestId(`pilula-${id}`)).not.toHaveAttribute("data-valor", "");
        // Tirar o filtro (tocar de novo na mesma opção) também aplica e fecha.
        const painel2 = await abrir(page, id);
        await painel2.locator(`button[data-testid^="pilula-${id}-"][aria-pressed="true"]`).first().click();
        await expect(page.getByTestId(`painel-pilula-${id}`)).toHaveCount(0);
      }

      for (const id of ["datas", "local"]) {
        const painel = await abrir(page, id);
        const acao = painel.getByTestId("painel-pilula-fechar");
        await expect(acao).toHaveText("Ver resultados");
        await acao.click();
        await expect(page.getByTestId(`painel-pilula-${id}`)).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t912-e457-${w}.png` });
    });
  });
}
