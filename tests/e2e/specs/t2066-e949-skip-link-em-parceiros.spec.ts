import { test, expect } from "@playwright/test";

/*
  T2066 — E949 (Pista 3; autorizado pelo Gerente em 17/11, ronda 02:55Z) @E949 @ao-vivo-seguro
  Regra decidida (correção no draft #3861): em /parceiros, o link "Pular para o conteúdo principal" aparece à vista
  quando recebe o foco pelo teclado e não fica escondido sob o cabeçalho fixo; ao segui-lo, o início
  do conteúdo fica ABAIXO do cabeçalho (nada coberto) e o foco vai para o conteúdo — não fica no <body>.
  Trava: vermelha na main até a correção entrar. Visitante, só leitura. 390 e 1280 px.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280]) {
  test(`T2066 — E949: a ${largura} px o salto para o conteúdo de /parceiros fica à vista e leva o foco ao conteúdo @E949 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.locator("main#conteudo")).toBeVisible({ timeout: 30_000 });
    const salto = page.getByRole("link", { name: "Pular para o conteúdo principal" });

    // 1. O Tab foca o salto, e ele aparece inteiro, por cima de tudo (não sob o cabeçalho).
    // (A posição do salto na ordem do Tab não é a regra deste item: a 1280 px o "Fale com a Viva" flutuante vem antes.)
    await page.waitForLoadState("load");
    for (let i = 0; i < 6 && !(await salto.evaluate((a) => a === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(salto, "o Tab chega ao salto logo no começo da página").toBeFocused();
    await expect(salto).toBeVisible();
    // O salto entra deslizando (0,18 s): mede até assentar.
    const medirSalto = () => salto.evaluate((a) => {
      const r = a.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return "sem tamanho";
      if (r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight) return "fora da tela";
      const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return alvo && (alvo === a || a.contains(alvo)) ? "ok" : `coberto por <${alvo?.tagName.toLowerCase()}>`;
    });
    await expect.poll(medirSalto, { message: "o salto focado fica à vista", timeout: 3_000 }).toBe("ok");

    // 2. Seguir o salto: o conteúdo começa abaixo do cabeçalho fixo e o foco sai do topo da página.
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#conteudo");
    await page.waitForTimeout(300); // a rolagem do salto assenta
    const medida = await page.evaluate(() => {
      const main = document.getElementById("conteudo")!;
      // O cabeçalho preso no TOPO (a barra fixa de baixo, no celular, não conta).
      const cabecalho = [...document.querySelectorAll<HTMLElement>("header, nav")]
        .filter((h) => {
          const r = h.getBoundingClientRect();
          return ["fixed", "sticky"].includes(getComputedStyle(h).position) && r.height > 0 && r.top <= 1 && r.bottom < innerHeight / 2;
        })
        .map((h) => h.getBoundingClientRect().bottom);
      const ativo = document.activeElement;
      return {
        topoConteudo: main.getBoundingClientRect().top,
        fimCabecalho: cabecalho.length ? Math.max(...cabecalho) : 0,
        focoNoConteudo: !!ativo && ativo !== document.body && (ativo === main || main.contains(ativo)),
        foco: ativo?.tagName.toLowerCase(),
      };
    });
    expect(medida.fimCabecalho, "há um cabeçalho fixo a medir").toBeGreaterThan(0);
    expect(medida.topoConteudo, `o conteúdo começa a ${medida.topoConteudo} px, sob o cabeçalho que termina a ${medida.fimCabecalho} px`).toBeGreaterThanOrEqual(medida.fimCabecalho - 1);
    expect(medida.focoNoConteudo, `o foco ficou em <${medida.foco}>`).toBe(true);
  });
}
