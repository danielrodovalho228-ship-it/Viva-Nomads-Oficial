import { test, expect } from "@playwright/test";

/**
 * T90 — Orçamento de velocidade (ordem 0f66a754, item 6): visitante sem cookie
 * a 390 px. TTFB < 800 ms (mediana de 3 cargas, a 1ª aquece o servidor) e
 * LCP < 2,5 s nas rotas públicas principais. Falha se a lentidão voltar.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

const ROTAS = ["/", "/buscar", "/precos"];
const TTFB_MAX_MS = 800;
const LCP_MAX_MS = 2500;

function mediana(n: number[]): number {
  const o = [...n].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

for (const rota of ROTAS) {
  test(`${rota}: TTFB < ${TTFB_MAX_MS} ms e LCP < ${LCP_MAX_MS} ms (390 px, visitante)`, async ({ page }) => {
    const ttfbs: number[] = [];
    let lcp = 0;
    for (let i = 0; i < 4; i++) {
      await page.addInitScript(() => {
        (window as unknown as { __lcp: number }).__lcp = 0;
        new PerformanceObserver((l) => {
          const e = l.getEntries();
          (window as unknown as { __lcp: number }).__lcp = e[e.length - 1].startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      const res = await page.goto(rota, { waitUntil: "load" });
      expect(res?.status(), `${rota} deve responder 200`).toBe(200);
      const t = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return { ttfb: nav.responseStart - nav.requestStart, lcp: (window as unknown as { __lcp: number }).__lcp };
      });
      if (i > 0) ttfbs.push(t.ttfb); // descarta a carga fria
      lcp = i === 3 ? t.lcp : lcp;
    }
    expect(mediana(ttfbs), `TTFB mediano de ${rota}`).toBeLessThan(TTFB_MAX_MS);
    expect(lcp, `LCP de ${rota}`).toBeLessThan(LCP_MAX_MS);
  });
}
