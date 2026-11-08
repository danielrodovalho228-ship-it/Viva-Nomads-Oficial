import { test, expect } from "@playwright/test";

/*
  T1491 — dois testes propostos pela QA (rodada 08:50, 08/11), sobre itens já provados ao vivo e mergeados. Visitante.
    T-E452-neg: /buscar?tipo=loft não mostra o botão "Nível" na faixa de filtros (filtro que não filtra não se mostra); /buscar?nivel=premium
                mostra o botão "Premium" e, ao desligá-lo, a URL fica sem `nivel`.
    T-E436:     com o mapa à vista, o topo público (data-testid=topo-publico) não fica coberto: ao longo dele, elementFromPoint devolve sempre um
                descendente dele (a 1280 e a 390 px).
  O T-E458-390 (menu de /empresas a 390 px com o link "Parceiros") fica para a próxima passada: pede o seletor do menu do celular.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1491 — E452 (caso negativo) e E436 (topo não coberto)", () => {
  test("E452: com tipo=loft não há botão Nível; com nivel=premium há 'Premium' e desligar tira o nivel da URL", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto("/buscar?tipo=loft", { waitUntil: "domcontentloaded" });
    expect(r?.status() ?? 0).toBeLessThan(400);
    const linha = page.getByTestId("linha-pilulas");
    await expect(linha).toBeVisible({ timeout: 30_000 });
    await expect(linha.getByRole("button", { name: /^Nível/ })).toHaveCount(0);
    await expect(page.getByTestId("pilula-nivel")).toHaveCount(0);

    await page.goto("/buscar?nivel=premium", { waitUntil: "domcontentloaded" });
    const premium = page.getByTestId("linha-pilulas").getByRole("button", { name: /Premium/ });
    await expect(premium).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("pilula-nivel").click();
    const painel = page.getByTestId("painel-pilula-nivel");
    await expect(painel).toBeVisible();
    // desligar: a opção ativa de novo, ou a opção "qualquer nível" — o resultado é a URL sem `nivel`
    const ativa = painel.getByRole("button", { name: /Premium/ }).first();
    await ativa.click();
    await expect.poll(() => new URL(page.url()).searchParams.has("nivel"), { timeout: 15_000, message: "a URL fica sem nivel" }).toBe(false);
  });

  for (const w of [1280, 390] as const) {
    test(`E436 a ${w} px: nada cobre o topo público (elementFromPoint ao longo dele)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const topo = page.getByTestId("topo-publico");
      await expect(topo).toBeVisible({ timeout: 30_000 });
      const cobertos = await topo.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const ruins: string[] = [];
        for (let i = 0; i <= 10; i++) {
          const x = Math.min(innerWidth - 1, Math.max(0, b.left + (b.width * i) / 10));
          const y = b.top + b.height / 2;
          const no = document.elementFromPoint(x, y);
          if (!no || !el.contains(no)) ruins.push(`x=${Math.round(x)} y=${Math.round(y)} → ${no?.tagName.toLowerCase() ?? "nada"}`);
        }
        return ruins;
      });
      expect(cobertos, `pontos do topo cobertos por outro elemento: ${cobertos.join("; ")}`).toEqual([]);
    });
  }
});
