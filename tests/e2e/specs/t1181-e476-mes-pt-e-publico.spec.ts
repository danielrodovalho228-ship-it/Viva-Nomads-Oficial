import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T1181 — E476 (#2695, 05/11), acabamento do admin:
 *  (ii) Marketing: o mês do "Novo lançamento" é uma lista em PORTUGUÊS ("novembro de 2026"), do mês atual para trás, com
 *       o mesmo valor gravado (AAAA-MM). Antes o <input type="month"> nativo escrevia no idioma do navegador.
 *  (iii) Anúncios: "aparecem para o público" só conta anúncio REAL; a demonstração diz "como exemplo".
 * O E476 entrou só com teste de unidade; aqui é a tela, com a sessão de admin do laboratório, 390 e 1280:
 *   1. Marketing: não há campo de mês nativo; a 1ª opção do mês é o mês atual (Brasília), em português, com valor AAAA-MM;
 *      nenhuma opção traz nome de mês em inglês;
 *   2. Anúncios de demonstração: nenhuma linha diz "sim" para o público; se há demonstração no ar, o resumo diz
 *      "como exemplo";
 *   3. sem estouro horizontal.
 */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const agoraBRT = new Date(Date.now() - 3 * 3_600_000);
const VALOR_ATUAL = `${agoraBRT.getUTCFullYear()}-${String(agoraBRT.getUTCMonth() + 1).padStart(2, "0")}`;
const ROTULO_ATUAL = `${MESES[agoraBRT.getUTCMonth()]} de ${agoraBRT.getUTCFullYear()}`;
const INGLES = /January|February|March|April|May|June|July|August|September|October|November|December/;

test.describe("T1181 — E476: mês em português no Marketing e 'público' só para anúncio real", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  for (const w of [390, 1280] as const) {
    test(`Marketing com o mês em português; demonstração "como exemplo" (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 }, locale: "en-US" });
      const page = await ctx.newPage();
      try {
        await page.goto("/admin/marketing", { waitUntil: "domcontentloaded" });
        await expect(page.getByText("Novo lançamento", { exact: true })).toBeVisible({ timeout: 30_000 });
        const form = page.locator("form").filter({ has: page.getByText("Mês", { exact: true }) }).first();
        await expect(form.locator('input[type="month"]')).toHaveCount(0);
        const mes = form.locator("select").first();
        const opcoes = await mes.locator("option").evaluateAll((os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, rotulo: (o.textContent ?? "").trim() })));
        expect(opcoes[0], "a 1ª opção é o mês atual, em português").toEqual({ valor: VALOR_ATUAL, rotulo: ROTULO_ATUAL });
        for (const o of opcoes) {
          expect(o.valor).toMatch(/^\d{4}-\d{2}$/);
          expect(o.rotulo).not.toMatch(INGLES);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

        await page.goto("/admin/imoveis?tipo=demonstracao", { waitUntil: "domcontentloaded" });
        const resumo = page.getByTestId("lista-publico");
        await expect(resumo).toBeVisible({ timeout: 30_000 });
        const rotulos = (await page.getByTestId("imovel-publico").allInnerTexts()).map((s) => s.trim());
        expect(rotulos, "demonstração nunca 'sim' para o público").not.toContain("sim");
        if (rotulos.includes("como exemplo")) await expect(resumo).toContainText("como exemplo");
        await expect(resumo).not.toContainText(/de demonstração aparecem? para o público/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
