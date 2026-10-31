import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T794 — #1747 (E292-bis, "a Viva só conecta"), Pista C, bloco 114. A Viva não calcula imposto com regra própria: o
  simulador PF × PJ saiu do painel, do menu e da central de Ferramentas. Pelas telas de verdade, a 390 e a 1280 px, como
  proprietário:
   1. o endereço antigo /dashboard/tributacao leva para /dashboard/ferramentas (sem o simulador);
   2. a central de Ferramentas não tem mais o cartão "Tributação PF × PJ" e, no lugar, o grupo "Análise & cálculo" tem
      o cartão "Desempenho do anúncio" (para Meus imóveis), sem o atalho de texto antigo abaixo da grade; os 3 grupos
      seguem com 4 cartões (grade par);
   3. o menu lateral do proprietário não tem mais "Tributação".
  A memória de cálculo interna dos sócios (/tributario) fica atrás do acesso de sócios e não é tela do dono (fora daqui).
*/
test.use({ storageState: authFile("proprietario") });

for (const largura of [1280, 390] as const) {
  test(`${largura} px: sem simulador de imposto — o endereço antigo vai para Ferramentas e o cartão vira "Desempenho do anúncio" (#1747)`, async ({ page }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/dashboard/tributacao", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/ferramentas$/, { timeout: 30_000 });
    await expect(page.getByTestId("ferramenta-tributacao")).toHaveCount(0);

    const grupos = page.getByTestId("ferramentas-grupo");
    await expect(grupos).toHaveCount(3, { timeout: 30_000 });
    for (let i = 0; i < 3; i++) await expect(grupos.nth(i).getByTestId("ferramenta-card")).toHaveCount(4);
    await expect(page.getByText("Tributação PF × PJ")).toHaveCount(0);
    const analise = grupos.filter({ hasText: "Análise & cálculo" });
    const desempenho = analise.getByTestId("ferramenta-card").filter({ hasText: "Desempenho do anúncio" });
    await expect(desempenho).toHaveCount(1);
    await expect(desempenho).toHaveAttribute("href", "/dashboard/imoveis");
    await expect(page.getByTestId("atalho-desempenho")).toHaveCount(0);

    // O menu do proprietário (lateral no computador; no celular, o menu de "Mais") não leva mais ao simulador de imposto.
    await expect(page.locator('a[href="/dashboard/tributacao"]')).toHaveCount(0);
  });
}
