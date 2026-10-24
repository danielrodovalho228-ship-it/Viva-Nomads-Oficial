import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T349 — L-31: a página do imóvel (/imoveis/[id], revalidate = 60) respondia HTTP 500 e o coração de favoritar não
 * aparecia. Causa: o selo do LinkedIn (63-B) lia cookies() durante a renderização em cache. Regressão: visitante abre a
 * página várias vezes, a 390 e a 1280 px (a 2ª renderização era a que quebrava) — sempre 200, com o coração; o perfil
 * público do proprietário (mesmo selo) também abre.
 * Rodada da vigia (Pista C, 23/10 à noite): confirmação depois do #1190 (L-31) no lab-crítico do PR da vigia.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t349.${sufixo}@lab.vivanomads.test`, nome: "Doroteia Imóvel", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T349 — L-31: página do imóvel sem HTTP 500", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio sem erro ${sufixo}`, { ativo: true, preco: 2500 });
  });
  test.afterAll(async () => {
    if (NO_LABORATORIO) await apagarContas([ids.dono]);
  });

  // A página tem um coração por tamanho de tela (galeria do celular e cabeçalho do computador); o primeiro do DOM pode
  // ser o escondido (lab-crítico do #1195). Vale o primeiro visível.
  test("visitante: 390 e 1280 px, várias cargas — sempre 200 e com o coração de favoritar", async ({ page }) => {
    for (const largura of [390, 1280, 390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const r = await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      expect(r?.status(), `HTTP a ${largura} px`).toBe(200);
      await expect(page.getByTestId("coracao").locator("visible=true").first()).toBeVisible({ timeout: 20_000 });
    }
    const r = await page.reload({ waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("coracao").locator("visible=true").first()).toBeVisible({ timeout: 20_000 });
  });

  test("perfil público do proprietário (mesmo selo do LinkedIn) também abre", async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      const r = await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
    }
  });
});
