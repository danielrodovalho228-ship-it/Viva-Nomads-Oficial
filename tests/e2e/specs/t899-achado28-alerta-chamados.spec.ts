import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T899 — achado nº 28 (#1958, Pista B): o aviso de chamados atrasados do topo do /admin e da Central de Agentes não some
  mais quando a leitura falha: diz "Não foi possível conferir agora os chamados atrasados. Abra a fila para ver."
  (chamados-vermelhos-erro na Central). A falha do banco não se provoca no laboratório sem quebrar a massa compartilhada
  (fica com os testes unitários do PR); aqui, o caminho NORMAL depois da troca: com a sessão de admin, /admin e
  /admin/agentes abrem SEM a frase de leitura falhada, a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const NAO_LIDO = "Não foi possível conferir agora os chamados atrasados";

test.describe("T899 — achado nº 28: alerta de chamados atrasados sem aviso falso de leitura (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin).");

  for (const rota of ["/admin", "/admin/agentes"] as const) {
    for (const largura of [1280, 390] as const) {
      test(`${rota} @${largura}: sem a frase de leitura falhada`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(400);
        expect(new URL(page.url()).pathname).toBe(rota);
        await page.locator("main").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const corpo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        console.log(`t899|${rota}|${largura}|naoLido=${corpo.includes(NAO_LIDO)}|atraso=${/chamado[s]? (?:atrasad|em vermelho|sem resposta)/i.test(corpo)}`);
        expect(corpo, "a leitura dos chamados atrasados funcionou: sem a frase de falha").not.toContain(NAO_LIDO);
        await expect(page.getByTestId("chamados-vermelhos-erro")).toHaveCount(0);
        await page.screenshot({ path: `${SAIDA}/t899-${rota.replace(/\//g, "-").slice(1)}-${largura}.png` });
        await ctx.close();
      });
    }
  }
});
