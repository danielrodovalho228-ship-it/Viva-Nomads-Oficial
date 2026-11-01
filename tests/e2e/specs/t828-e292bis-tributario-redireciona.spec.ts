import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T828 — #1793 (E292-bis, fecho), Pista C, bloco 140. "A Viva só conecta": a memória de cálculo PF × PJ dos sócios saiu.
  O endereço antigo /tributario leva para Ferramentas (como /dashboard/tributacao, #1747), e o acesso de sócios continua
  na frente da rota. Pela tela de verdade, a 390 e a 1280 px: entrando pela porta dos sócios com o código do
  laboratório (SOCIOS_ACCESS_CODE; sem ele, pula), com a sessão de admin, /tributario termina em /dashboard/ferramentas,
  sem o simulador de imposto. O resto do #1793 (a taxa do Airbnb fora do preço sugerido) tem teste de unidade no merge
  (preco-justo.test.ts, complemento-27b.test.ts).
*/
const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;

for (const largura of [1280, 390] as const) {
  test(`${largura} px: /tributario, pela porta dos sócios, termina em Ferramentas, sem simulador de imposto (#1793)`, async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    test.skip(!CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const p = await ctx.newPage();
    await p.goto(`/acesso-socios?next=${encodeURIComponent("/tributario")}`, { waitUntil: "domcontentloaded" });
    await p.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
    await p.getByRole("button", { name: "Entrar" }).click();
    await p.waitForURL((u) => u.pathname === "/dashboard/ferramentas", { timeout: 30_000 });
    await expect(p.getByTestId("ferramentas-grupo").first()).toBeVisible({ timeout: 20_000 });
    await expect(p.getByText("Memória de cálculo")).toHaveCount(0);
    await expect(p.getByTestId("ferramenta-tributacao")).toHaveCount(0);
    await ctx.close();
  });
}
