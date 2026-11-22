import { test, expect, type Page } from "@playwright/test";

/**
 * T1627 — E780 REABERTO (print do Daniel, 14/11 09:48): a 390 px o primeiro chip da barra de filtros da /buscar saía
 * cortado na borda esquerda e uma barra de rolagem aparecia sob os chips. Só aceito com a barra ÍNTEGRA a 390 px:
 *  - chips inteiros desde o primeiro (todos dentro da janela, com a margem da página);
 *  - sem rolagem lateral da fileira (nada passa da largura dela; nenhum overflow-x rolável);
 *  - sem barra de rolagem visível;
 *  - sem deslocamento ao carregar e ao rolar (a posição de cada chip não muda).
 * Sem login nem banco: exemplos da casa (/buscar?exemplos=1) e uma busca com filtros ligados (rótulos mais longos).
 */
const LARGURA = 390;
const ENDERECOS = ["/buscar?exemplos=1", "/buscar?exemplos=1&tipo=apartamento&maxPrice=3000&ordem=price_asc"];

type Caixa = { id: string; x: number; y: number; w: number; h: number };
const caixas = (p: Page) =>
  p.locator('[data-testid="linha-pilulas"] [data-testid^="pilula-"]').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute("data-testid")!, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    })
  );

const alturaBarra = (p: Page) => p.getByTestId("linha-pilulas").evaluate((e) => Math.round(e.getBoundingClientRect().height));

async function conferirIntegra(p: Page, onde: string) {
  const lista: Caixa[] = await caixas(p);
  expect(lista.length, `${onde}: chips na barra`).toBeGreaterThanOrEqual(7);
  for (const c of lista) {
    expect(c.x, `${onde}: ${c.id} começa dentro da margem da página (x=${c.x})`).toBeGreaterThanOrEqual(16);
    expect(c.x + c.w, `${onde}: ${c.id} termina dentro da margem da página (fim=${c.x + c.w})`).toBeLessThanOrEqual(LARGURA - 16);
    expect(c.w, `${onde}: ${c.id} tem largura`).toBeGreaterThan(30);
  }
  const fileiras = await p.locator('[data-testid="pilulas-filtros"], [data-testid="pilulas-acoes"]').evaluateAll((els) =>
    els.map((e) => {
      const el = e as HTMLElement;
      const cs = getComputedStyle(el);
      return { id: el.dataset.testid, sobra: el.scrollWidth - el.clientWidth, ox: cs.overflowX, barraAltura: el.offsetHeight - el.clientHeight };
    })
  );
  for (const f of fileiras) {
    expect(f.sobra, `${onde}: a fileira ${f.id} não rola de lado (sobra ${f.sobra}px)`).toBeLessThanOrEqual(0);
    expect(["auto", "scroll"].includes(f.ox), `${onde}: a fileira ${f.id} não é rolável de lado (overflow-x ${f.ox})`).toBe(false);
    expect(f.barraAltura, `${onde}: a fileira ${f.id} não reserva barra de rolagem`).toBe(0);
  }
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${onde}: a página não rola de lado`).toBe(true);
  return lista;
}

test.describe("T1627 — E780 reaberto: barra de filtros íntegra a 390 px", () => {
  for (const url of ENDERECOS) {
    test(`390 px ${url}: chips inteiros, sem rolagem lateral nem barra, sem deslocamento`, async ({ page }) => {
      await page.setViewportSize({ width: LARGURA, height: 844 });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pilula-datas")).toBeVisible({ timeout: 30_000 });
      const aoAbrir = await conferirIntegra(page, "ao abrir");
      const alturaAoAbrir = await alturaBarra(page);

      // Carregou tudo (lista, contagens, mapa preguiçoso): nenhum chip mudou de lugar.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      const carregada = await conferirIntegra(page, "carregada");
      // Nenhum chip muda de lugar (x, y) e a barra não muda de altura. Dois ajustes da própria busca são aceitos, porque
      // não empurram nada: o chip ganha o valor lido da URL depois de abrir (a largura dele muda, ex.: "Tipo" →
      // "Apartamento") e a pílula "Nível" surge no fim da fileira quando os imóveis chegam (E452). Ver docs/e780-*.md.
      const depois = new Map(carregada.map((c) => [c.id, c]));
      for (const c of aoAbrir) {
        const d = depois.get(c.id);
        expect(d, `${c.id} continua na barra depois de carregar`).toBeTruthy();
        expect({ x: d!.x, y: d!.y }, `${c.id} não se desloca ao carregar`).toEqual({ x: c.x, y: c.y });
      }
      for (const c of carregada.filter((c) => !aoAbrir.some((a) => a.id === c.id))) {
        expect(c.id, "só a pílula Nível pode surgir depois de carregar").toBe("pilula-nivel");
      }
      expect(await alturaBarra(page), "a barra não muda de altura ao carregar").toBe(alturaAoAbrir);

      // Rolando: a barra é presa (E780) — mesmos x, mesma distância entre si, nenhuma linha some ou entra.
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(300);
      const rolada = await conferirIntegra(page, "rolada");
      const relativa = (l: Caixa[]) => l.map((c) => ({ id: c.id, x: c.x, w: c.w, dy: c.y - l[0].y }));
      expect(relativa(rolada), "os chips não se deslocam entre si ao rolar").toEqual(relativa(carregada));
    });
  }
});
