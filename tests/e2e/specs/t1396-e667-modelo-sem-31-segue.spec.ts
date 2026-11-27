import { test, expect } from "@playwright/test";
import { FAIXAS_COMISSAO_PADRAO } from "../../../src/lib/cobranca/regra";
import { TEXTO_CARTEIRAS } from "../../../src/config/planos";

/*
  T1396 — E667 (#3117): em /modelodenegocio (dos sócios), o gráfico "Receita da Viva por faixa de imóveis" não diz mais
  "31+ segue em 6% até negociar": a legenda traz a linha de carteiras e o rótulo da faixa sem teto leva o mínimo
  dela (não um 31 fixo). Entra pela porta /acesso-socios com SOCIOS_ACCESS_CODE (sem o código, pula). 390 e 1280 px, sem estouro.
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a legenda do gráfico trazia "Plano Gestor: {GESTOR_TEXTO}";
  agora traz TEXTO_CARTEIRAS e a página não cita o Plano Gestor. A faixa sem teto é a "16+".
*/
const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];

test.describe("T1396 — E667: /modelodenegocio sem a linha '31+ segue em 6%'", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    test.skip(!process.env.SOCIOS_ACCESS_CODE, "sem o código de sócios no ambiente");
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/acesso-socios?next=${encodeURIComponent("/modelodenegocio")}`, { waitUntil: "domcontentloaded" });
      await page.locator('input[name="codigo"]').fill(process.env.SOCIOS_ACCESS_CODE!);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/modelodenegocio$/, { timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const texto = ((await page.locator("body").innerText()) ?? "").replace(/\s+/g, " ");
      expect(texto).toContain("Receita da Viva por faixa de imóveis");
      expect(texto).not.toMatch(/31\+ segue em 6%/);
      // 078 (Daniel, 16/11/2026): antes `toContain("Plano Gestor: " + GESTOR_TEXTO)`; agora a legenda do gráfico termina
      // na linha de carteiras, e o Plano Gestor é cobrado como ausente da página inteira.
      expect(texto).toContain(`Com o mesmo cenário, no limite inferior de cada faixa. ${TEXTO_CARTEIRAS}`);
      expect(texto).not.toMatch(/Plano Gestor/i);
      expect(texto).toContain(`${ultima.minImoveis}+`);
      expect(ultima.minImoveis).toBe(16); // 078 (Daniel, 16/11/2026): a faixa sem teto começa em 16 (antes, 20 — a do Gestor).
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
