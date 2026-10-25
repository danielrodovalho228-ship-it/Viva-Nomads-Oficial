import { test, expect } from "@playwright/test";

/*
  T543 — E166 (#1381), guarda permanente da Pista C: a troca do fundo bege/creme pelo clean não regride nas páginas
  PÚBLICAS. O unitário fundo-clean-e166.test.ts olha o código; aqui é o que a página DESENHA: em cada página, nenhum
  elemento visível com o fundo bege "areia" (#f7f2ea) ou creme (#fbfaf4) — nem o body. A 390 e 1280 px, sem login.
*/
const PAGINAS = [
  "/",
  "/buscar",
  "/cidades",
  "/como-funciona",
  "/para-proprietarios",
  "/precos",
  "/empresas",
  "/parceiros",
  "/guias",
  "/ajuda",
  "/seguranca",
  "/privacidade",
  "/termos",
  "/auth",
  "/pedidos/novo",
];
const PROIBIDOS = ["rgb(247, 242, 234)", "rgb(251, 250, 244)"];

test.describe("T543 — E166: nenhuma página pública com o fundo bege/creme", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: 240_000 });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: ${PAGINAS.length} páginas sem #f7f2ea nem #fbfaf4`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const achados: string[] = [];
      for (const rota of PAGINAS) {
        const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
        if (!r || r.status() >= 400) {
          achados.push(`${rota}: status ${r?.status()}`);
          continue;
        }
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const bege = await page.evaluate((proibidos) => {
          const out: string[] = [];
          for (const el of [document.documentElement, document.body, ...Array.from(document.body.querySelectorAll("*"))]) {
            const cs = getComputedStyle(el);
            if (!proibidos.includes(cs.backgroundColor)) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.display === "none") continue;
            const id = (el as HTMLElement).dataset?.testid ? `[data-testid=${(el as HTMLElement).dataset.testid}]` : "";
            out.push(`${el.tagName.toLowerCase()}${id}.${String((el as HTMLElement).className).slice(0, 60)} ${cs.backgroundColor}`);
          }
          return out.slice(0, 3);
        }, PROIBIDOS);
        for (const b of bege) achados.push(`${rota}: ${b}`);
      }
      console.log(`t543 ${w}: ${JSON.stringify(achados)}`);
      expect(achados, "elementos com o fundo bege/creme antigo").toEqual([]);
    });
  }
});
