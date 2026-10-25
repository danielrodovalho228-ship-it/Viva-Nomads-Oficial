import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T75 — Barra fixa no celular na página do imóvel (ordem aa421902, UX1): valor por mês,
 * "Caução e taxas no detalhe" e "Solicitar" (Prompt 41) visíveis sem rolar até o fim; some no
 * computador; no anúncio de exemplo aparece em demonstração.
 */
const senha = novaSenha();
const dono = { email: `dono.barra.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Barra", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T75 — Barra fixa do imóvel", () => {
  test("anúncio de exemplo mostra a barra em demonstração (ordem 4f8023d1)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    await expect(page.getByTestId("barra-fixa-imovel")).toBeVisible();
    await expect(page.getByTestId("barra-demo")).toBeVisible();
  });

  test.describe("imóvel real", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    test.beforeAll(async () => {
      ids.dono = await criarConta(dono, senha);
      ids.imovel = await criarImovelPronto(ids.dono, "Studio barra fixa", { ativo: true, preco: 2800 });
    });
    test.afterAll(async () => {
      await apagarContas([ids.dono]);
    });

    for (const largura of [360, 390]) {
      test(`${largura} px: barra visível no topo da página, com valor e botão`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 800 });
        await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
        const barra = page.getByTestId("barra-fixa-imovel");
        await expect(barra).toBeVisible();
        await expect(barra).toContainText(/R\$\s?2\.800/);
        await expect(barra).toContainText("Caução e taxas no detalhe");
        await expect(barra.getByRole("button", { name: "Solicitar", exact: true })).toBeVisible();
        const caixa = await barra.boundingBox();
        expect(caixa!.x).toBeGreaterThanOrEqual(0);
        expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(largura + 1);
        // sem rolagem lateral
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }

    test("sem sessão, o botão leva ao login e volta para o anúncio (mesma ação do cartão)", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      await page.getByTestId("barra-fixa-imovel").getByRole("button", { name: "Solicitar", exact: true }).click();
      // Passo de confirmação (#671): só o último "Enviar candidatura" (após Continuar) leva ao login.
      await page.getByTestId("solicitacao-passo").getByRole("button", { name: "Continuar" }).click();
      await page.getByTestId("solicitacao-passo").getByRole("button", { name: "Continuar" }).click();
      await page.getByTestId("solicitacao-passo").getByRole("button", { name: "Enviar candidatura" }).click();
      // Prompt 49: a entrada diz o porquê (candidatura) e volta para o anúncio.
      await page.waitForURL(/\/auth\?motivo=candidatura&redirect=%2Fimoveis%2F/, { timeout: 15_000 });
    });

    test("1280 px: a barra não aparece (o cartão sticky continua)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      await expect(page.getByTestId("barra-fixa-imovel")).toBeHidden();
    });
  });
});
