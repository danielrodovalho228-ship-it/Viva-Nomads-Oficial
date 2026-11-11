import { test, expect } from "@playwright/test";

/**
 * T1593 — GUARDA DO E781 (#3610, merge na main em 09/11): no celular, tocar numa aba do anúncio ("Seções do anúncio") rola
 * por código até a seção, com a compensação das abas presas (base das abas + 8 px), grava o #hash e deixa marcada (aria-current)
 * a aba tocada — o salto nativo do #hash sozinho podia não sair do lugar. Anúncio de exemplo da casa (ube-003), sem login nem
 * banco, a 390 px com toque. Para CADA aba: a seção termina logo abaixo das abas (folga de 24 px sobre os 8 px da regra), o #hash
 * é o da aba e a aba ativa é a tocada. A posição é conferida duas vezes (a página muda de altura ao carregar).
 */
test.describe("T1593 — E781: abas do anúncio rolam até a seção (390px, toque)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("ube-003: cada aba leva à sua seção, com o #hash e a aba ativa certos", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/imoveis/ube-003", { waitUntil: "domcontentloaded" });
    const nav = page.getByTestId("nav-secoes");
    await expect(nav).toBeVisible({ timeout: 30_000 });
    const ids = await nav.locator("a[data-secao]").evaluateAll((as) => as.map((a) => (a as HTMLElement).dataset.secao as string));
    expect(ids.length, "o anúncio tem abas").toBeGreaterThanOrEqual(3);

    for (const id of ids) {
      const aba = nav.locator(`a[data-secao="${id}"]`);
      await aba.scrollIntoViewIfNeeded();
      await aba.tap();
      // A regra confere a posição por ~1,4 s (a página ainda muda de altura): espera assentar e mede duas vezes.
      await page.waitForTimeout(1_600);
      const medida = async () =>
        page.evaluate((secao) => {
          const el = document.getElementById(secao);
          const n = document.querySelector('[data-testid="nav-secoes"]');
          if (!el || !n) return null;
          return { topo: el.getBoundingClientRect().top, baseAbas: n.getBoundingClientRect().bottom };
        }, id);
      const m1 = await medida();
      await page.waitForTimeout(500);
      const m2 = await medida();
      expect(m1, `seção ${id} existe`).not.toBeNull();
      for (const m of [m1!, m2!]) {
        const folga = m.topo - m.baseAbas;
        expect(folga, `${id}: a seção fica logo abaixo das abas (folga ${Math.round(folga)}px)`).toBeGreaterThanOrEqual(-4);
        expect(folga, `${id}: a seção não fica longe das abas (folga ${Math.round(folga)}px)`).toBeLessThanOrEqual(32);
      }
      expect(Math.abs(m1!.topo - m2!.topo), `${id}: a seção não anda depois de assentar`).toBeLessThanOrEqual(3);
      expect(new URL(page.url()).hash, `${id}: o #hash é o da aba`).toBe(`#${id}`);
      await expect(nav.locator(`a[data-secao="${id}"]`), `${id}: a aba tocada fica marcada`).toHaveAttribute("aria-current", "true");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
