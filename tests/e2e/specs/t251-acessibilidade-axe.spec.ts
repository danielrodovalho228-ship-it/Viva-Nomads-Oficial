import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bloqueantes, descreverViolacoes, ROTAS_AXE_PUBLICAS } from "../../../src/lib/lab/axe-regras";

/*
  T251 — Acessibilidade (ordem 21708cca, parte D): @axe-core/playwright em cada página pública principal,
  a 390 e 1280 px. Falha com qualquer violação "crítica" ou "séria"; as demais vão como anotação do teste
  (aparecem no relatório do laboratório, sem reprovar). A mensagem traz só regra e seletor, nunca o HTML.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [390, 1280]) {
  test.describe(`axe ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const rota of ROTAS_AXE_PUBLICAS) {
      test(`${rota}: zero violações sérias ou críticas`, async ({ page }, info) => {
        test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
        await page.goto(rota, { waitUntil: "networkidle" });
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of violations.filter((x) => !bloqueantes([x]).length)) {
          info.annotations.push({ type: "axe-nao-bloqueante", description: `${v.id} (${v.impact}) em ${v.nodes.length} lugar(es)` });
        }
        expect(descreverViolacoes(violations), `${rota} @${largura}`).toBe("");
      });
    }
  });
}
