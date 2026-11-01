import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T893 — achado nº 24 (#1948, Pista B): o Início do painel passou a ler cada lista com `exigir` e, se uma leitura falha,
  mostra o aviso "inicio-sem-leitura" no topo e "—" no contador. A falha do banco não se provoca no laboratório sem
  quebrar a massa compartilhada (fica com os testes unitários do PR); aqui, o caminho NORMAL depois da troca: com as
  leituras funcionando, o Início do morador e do proprietário abre SEM o aviso, e os contadores do morador mostram
  número (nunca "—"), a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T893 — achado nº 24: Início sem aviso falso de leitura (morador e proprietário, 1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessões de morador e de proprietário).");

  for (const papel of ["inquilino", "proprietario"] as const) {
    for (const largura of [1280, 390] as const) {
      test(`${papel} @${largura}: Início sem 'inicio-sem-leitura'; contadores com número`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: authFile(papel), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        const r = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await expect(page.getByTestId("inicio-sem-leitura"), "nenhuma leitura falhou: sem o aviso").toHaveCount(0);
        const kpis = page.getByTestId("inicio-morador-kpis");
        if (await kpis.count()) {
          const textos = await kpis.locator("a, div").filter({ hasText: /Candidaturas|Buscas salvas|Mensagens/ }).allInnerTexts();
          console.log(`t893|${papel}|${largura}|kpis|${textos.join(" | ").replace(/\s+/g, " ")}`);
          await expect(kpis, "contadores do morador com número").not.toContainText("—");
        }
        await page.screenshot({ path: `${SAIDA}/t893-${papel}-${largura}.png` });
        await ctx.close();
      });
    }
  }
});
