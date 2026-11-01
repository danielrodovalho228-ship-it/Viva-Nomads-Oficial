import { test, expect, type Page } from "@playwright/test";

/*
  T871 — CONFORMIDADE FINA DO "COMO FUNCIONA" (Pista C, 01/11; merge #1886, F7, mockup publico-como-funciona). O merge
  trouxe só teste de fonte; aqui a cor de verdade, pelo estilo computado, a 390 e 1280 px, como visitante:
   1) nas duas trilhas (#para-inquilinos e #para-proprietarios), o título da trilha (h2) e o título de cada passo (h3)
      saem no verde da marca;
   2) o resto da página não mudou: o título "Pronto para começar?" (fora das trilhas) continua na cor do texto.
  O verde de referência é o de um elemento com a classe text-forest criado na própria página (sem cor fixa no teste).
*/
async function verdeDaMarca(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.createElement("span");
    el.className = "text-forest";
    document.body.appendChild(el);
    const cor = getComputedStyle(el).color;
    el.remove();
    return cor;
  });
}

for (const largura of [390, 1280] as const) {
  test(`T871 — "Como funciona": títulos das trilhas e dos passos em verde (#1886) @${largura}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    const r = await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.locator("#para-inquilinos h2")).toBeVisible({ timeout: 20_000 });
    const verde = await verdeDaMarca(page);

    for (const trilha of ["#para-inquilinos", "#para-proprietarios"]) {
      const secao = page.locator(trilha);
      const h2 = secao.locator("h2").first();
      expect(await h2.evaluate((e) => getComputedStyle(e).color), `${trilha}: título da trilha`).toBe(verde);
      const passos = secao.locator("h3");
      expect(await passos.count(), `${trilha}: passos`).toBeGreaterThan(0);
      const cores = await passos.evaluateAll((els) => els.map((e) => ({ texto: e.textContent?.trim(), cor: getComputedStyle(e).color })));
      for (const c of cores) expect(c.cor, `${trilha}: passo "${c.texto}"`).toBe(verde);
    }

    const fora = page.getByRole("heading", { name: "Pronto para começar?", exact: true });
    await expect(fora).toBeVisible();
    expect(await fora.evaluate((e) => getComputedStyle(e).color), "fora das trilhas, a cor do texto").not.toBe(verde);
  });
}
