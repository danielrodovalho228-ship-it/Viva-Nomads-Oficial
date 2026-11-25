import { test, expect } from "@playwright/test";
/* SONDA E781 (ORDEM-DUET-836) — só regista; não é trava. Para cada aba: tempo desde a carga, altura da página,
   scrollY, a posição da seção relativa às abas em 0/100/350/700/1400 ms, e o scroll-margin-top da seção. */
for (const modo of ["assente", "imediato"] as const) {
  test(`sonda E781 390px — toque ${modo}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto("/imoveis/ube-003", { waitUntil: "domcontentloaded" });
    const nav = page.getByTestId("nav-secoes");
    await expect(nav).toBeVisible({ timeout: 30_000 });
    if (modo === "assente") await page.waitForTimeout(4_000);
    const ids = await nav.locator("a[data-secao]").evaluateAll((as) => as.map((a) => (a as HTMLElement).dataset.secao as string));
    const linhas: string[] = [];
    for (const id of ids) {
      const aba = nav.locator(`a[data-secao="${id}"]`);
      await aba.scrollIntoViewIfNeeded();
      const antes = await page.evaluate(() => ({ y: Math.round(window.scrollY), h: document.documentElement.scrollHeight }));
      const tToque = Date.now() - t0;
      await aba.tap();
      const serie = await page.evaluate(async (secao) => {
        const marcas = [0, 100, 350, 700, 1400];
        const out: string[] = [];
        const ini = performance.now();
        for (const m of marcas) {
          while (performance.now() - ini < m) await new Promise((r) => setTimeout(r, 10));
          const el = document.getElementById(secao);
          const n = document.querySelector('[data-testid="nav-secoes"]');
          const folga = el && n ? Math.round(el.getBoundingClientRect().top - n.getBoundingClientRect().bottom) : null;
          out.push(`${m}ms:folga=${folga},y=${Math.round(window.scrollY)},h=${document.documentElement.scrollHeight}`);
        }
        const el = document.getElementById(secao);
        return { serie: out.join(" "), smt: el ? getComputedStyle(el).scrollMarginTop : "?", hash: location.hash };
      }, id);
      linhas.push(`SONDA-E781|${modo}|${id}|toque@${tToque}ms|antes y=${antes.y} h=${antes.h}|smt=${serie.smt}|hash=${serie.hash}|${serie.serie}`);
    }
    console.log(linhas.join("\n"));
    await ctx.close();
  });
}
