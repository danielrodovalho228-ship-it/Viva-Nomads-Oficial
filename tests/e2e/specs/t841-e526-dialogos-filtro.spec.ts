import { test, expect, type Page } from "@playwright/test";

/*
  T841 — E526 (D12, QA de cliques do morador 02/11): os painéis de filtro da busca (Datas, Local, Ordenar) abrem logo
  abaixo da linha de pílulas SEM cobrir o título ("N imóveis em …") nem os primeiros cartões — empurram o conteúdo. No
  computador, o calendário de Datas abre em linha dentro do painel e não tampa nada dele (antes pintava por cima do
  próprio painel). 1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";

const medir = (page: Page, id: string) =>
  page.evaluate((id) => {
    const caixa = (e: Element | null | undefined) => e?.getBoundingClientRect() ?? null;
    const sobre = (a: DOMRect | null, b: DOMRect | null) => !!a && !!b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const painel = caixa(document.querySelector(`[data-testid="painel-pilula-${id}"]`));
    const titulo = [...document.querySelectorAll("main h1, main h2")].find((h) => h.getBoundingClientRect().height > 0 && !h.closest("[role=dialog]"));
    const cartoes = [...document.querySelectorAll('main a[href^="/imoveis/"]')].filter((a) => !a.closest("[role=dialog]") && a.getBoundingClientRect().height > 0).slice(0, 3);
    return { cobreTitulo: sobre(painel, caixa(titulo)), cobreCartoes: cartoes.filter((c) => sobre(painel, caixa(c))).length };
  }, id);

for (const largura of [1280, 390] as const) {
  test.describe(`T841 — E526 (${largura}px)`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("Datas, Local e Ordenar não cobrem o título nem os cartões; o calendário não tampa o painel", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      for (const id of ["datas", "local", "ordenar"]) {
        await page.getByTestId(`pilula-${id}`).click();
        const painel = page.getByTestId(`painel-pilula-${id}`);
        await expect(painel).toBeVisible();
        expect(await medir(page, id), id).toEqual({ cobreTitulo: false, cobreCartoes: 0 });
        expect(await painel.evaluate((e) => getComputedStyle(e).position), `${id}: no fluxo`).toBe("static");

        if (id === "datas" && largura >= 1024) {
          await page.getByTestId("pilula-datas-entrada-calendario").click();
          const cal = page.getByTestId("pilula-datas-entrada-calendario-popup");
          await expect(cal).toBeVisible();
          // Nenhum controle do painel (fora do calendário) fica por baixo dele.
          const tampados = await page.evaluate(() => {
            const pn = document.querySelector('[data-testid="painel-pilula-datas"]')!;
            const c = document.querySelector('[data-testid="pilula-datas-entrada-calendario-popup"]')!;
            return [...pn.querySelectorAll<HTMLElement>("button, input")]
              .filter((e) => !c.contains(e) && e.getBoundingClientRect().height > 0)
              .filter((e) => {
                const r = e.getBoundingClientRect();
                const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return !!no && c.contains(no);
              })
              .map((e) => e.getAttribute("aria-label") || e.textContent?.trim() || e.tagName);
          });
          expect(tampados, "controles do painel por baixo do calendário").toEqual([]);
          await expect(page.getByTestId("painel-pilula-fechar")).toBeInViewport({ ratio: 0.5 }).catch(async () => {
            await page.getByTestId("painel-pilula-fechar").scrollIntoViewIfNeeded();
          });
          await page.getByTestId("painel-pilula-datas").screenshot({ path: `${SAIDA}/t841-datas-calendario-${largura}.png` });
          await cal.getByTestId("pilula-datas-entrada-calendario-popup-hoje").click().catch(() => page.keyboard.press("Escape"));
        }
        await page.getByTestId("painel-pilula-fechar").click();
        await expect(painel).toHaveCount(0);
      }
      expect(await page.evaluate((l) => document.documentElement.scrollWidth - l, largura)).toBeLessThanOrEqual(1);
    });
  });
}
