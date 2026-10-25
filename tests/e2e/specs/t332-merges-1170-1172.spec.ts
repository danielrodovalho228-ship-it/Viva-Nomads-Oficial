import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, temContaVarredura, type ChaveConta } from "../fixtures/varredura";

/*
  T332 — TESTES PERMANENTES DOS MERGES DE 23/10 À TARDE (Pista C). A 390 e 1280 px.
   1. #1170 (L-28): "Sair da Viva" (/dashboard/conta/excluir) com os três cartões em coluna única, para o morador e
      para o dono: uma coluna na grade e cada cartão abaixo do anterior, alinhados à esquerda, sem rolagem lateral.
      A t119 só confere a paridade das colunas a 1440 px.
   2. #1172 (E31): /admin/destinos diz se o tempo por rota está ligado; no laboratório (integrações simuladas) está.
  O #1171 (t343) e o #1173 (t303) já vieram com teste próprio nos dois tamanhos. Só no laboratório.
*/
async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "rolagem horizontal").toBeLessThanOrEqual(1);
}

test.describe("T332 — merges #1170 e #1172 (390 e 1280)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas da massa da varredura).");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const conta of ["INQUILINA", "DONO17"] as ChaveConta[]) {
    test(`#1170 — ${conta === "INQUILINA" ? "morador" : "dono"}: Sair da Viva em coluna única`, async ({ browser }) => {
      test.setTimeout(120_000);
      test.skip(!temContaVarredura(conta), `sem a conta ${conta} na massa`);
      for (const tam of TAMANHOS) {
        const { page, context } = await abrirComoConta(browser, conta, tam.nome);
        try {
          await page.goto("/dashboard/conta/excluir", { waitUntil: "domcontentloaded" });
          const grade = page.getByTestId("saida-cartoes");
          await expect(grade, `@${tam.nome}`).toBeVisible({ timeout: 20_000 });
          const colunas = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
          expect(colunas, `@${tam.nome}: colunas da grade`).toBe(1);
          const caixas = await grade.locator(":scope > li").evaluateAll((lis) => lis.map((li) => li.getBoundingClientRect()).map((r) => ({ x: Math.round(r.left), topo: r.top, base: r.bottom })));
          expect(caixas.length, `@${tam.nome}: três cartões`).toBe(3);
          for (let i = 1; i < caixas.length; i++) {
            expect(caixas[i].x, `@${tam.nome}: cartão ${i + 1} alinhado ao 1º`).toBe(caixas[0].x);
            expect(caixas[i].topo, `@${tam.nome}: cartão ${i + 1} abaixo do anterior`).toBeGreaterThanOrEqual(caixas[i - 1].base);
          }
          await semRolagemLateral(page);
        } finally {
          await context.close();
        }
      }
    });
  }

  test("#1172 — /admin/destinos diz que o tempo por rota está ligado", async ({ browser }) => {
    test.setTimeout(90_000);
    for (const tam of TAMANHOS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
      try {
        const page = await ctx.newPage();
        await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
        const aviso = page.getByTestId("destinos-provedor");
        await expect(aviso, `@${tam.nome}`).toHaveAttribute("data-ok", "1", { timeout: 20_000 });
        await expect(aviso).toContainText("Tempo por rota ligado");
        await expect(aviso).not.toContainText(/token|MAPBOX/i);
        await semRolagemLateral(page);
      } finally {
        await ctx.close();
      }
    }
  });
});
