import { test, expect } from "@playwright/test";

/*
  T1486 — C16 e C17, defeitos achados pela QA na rodada 07:05 (08/11) na busca; os dois testes são os que ela propôs à Pista C.
    C16: com algum filtro da folha ativo, a linha "Mais filtros · Ordenar · Mapa" estoura a largura no celular (3 px a 390, 33 px a 360):
         em /buscar?quartos=1 a 360 e 390 px, a página não rola para o lado e o botão "Mapa" termina dentro da tela.
    C17: fechar "Mais filtros" com Esc manda o foco para "Pular para o conteúdo principal"; deveria voltar ao botão que abriu
         (document.activeElement = [data-testid=pilula-mais]).
  C17 reproduz no laboratório: fica como test.fail ligado ao item da QA; quem corrigir remove o test.fail no mesmo PR (o Playwright avisa).
  C16 reproduz no laboratório a 360 px (5 px de rolagem lateral): test.fail ligado ao item. A 390 px o laboratório não reproduz (passou com
  test.fail: "Expected to fail, but passed"): os 3 px que a QA mediu em produção dependem da largura real da fonte do site; ali o teste é
  comum e guarda contra regressão MAIOR; o 390 de produção só se prova no navegador real, pelos trabalhadores de QA. Visitante.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T1486 — busca com filtro ativo (C16) e foco ao fechar Mais filtros (C17)", () => {
  for (const w of [360, 390] as const) {
    test(`C16 a ${w} px: /buscar?quartos=1 não rola para o lado e o Mapa cabe na tela`, async ({ page }) => {
      // 360 px reproduz no laboratório (5 px); 390 px não (a QA mediu 3 px em produção, fonte real): só o 360 é test.fail.
      test.fail(w === 360, "C16 (QA 07:05): a linha Mais filtros · Ordenar · Mapa estoura a largura com filtro ativo a 360 px");
      await page.setViewportSize({ width: w, height: 844 });
      const r = await page.goto("/buscar?quartos=1", { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const mapa = page.getByTestId("pilula-mapa");
      await expect(mapa).toBeVisible({ timeout: 30_000 });
      const folga = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const direita = await mapa.evaluate((el) => el.getBoundingClientRect().right - innerWidth);
      expect(folga, "rolagem lateral").toBeLessThanOrEqual(0);
      expect(direita, "o Mapa passa da borda").toBeLessThanOrEqual(0);
    });
  }

  test("C17 a 1280 px: Esc fecha Mais filtros e o foco volta ao botão", async ({ page }) => {
    test.fail(true, "C17 (QA 07:05): ao fechar Mais filtros com Esc o foco vai para o começo da página");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const mais = page.getByTestId("pilula-mais");
    await expect(mais).toBeVisible({ timeout: 30_000 });
    await mais.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const ativo = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? "");
    expect(ativo, "foco depois do Esc").toBe("pilula-mais");
  });
});
