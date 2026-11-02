import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/**
 * T971 — E399-C (#2105, PR 1 do Preço justo): o campo "Link do anúncio no Airbnb" do Passo 8, com a comparação
 * SIMULADA do selo "Preço justo", fica atrás da chave PRECO_JUSTO_COMPARADOR (NEXT_PUBLIC_…, desligada). O que a tela
 * real prova com a chave como está (desligada no laboratório e em produção), 390 e 1280:
 *   1. Passo 8 (preço) do cadastro: o campo do link (campo-link-airbnb / link-airbnb) NÃO aparece — nada de comparação
 *      nem de chamada ao Airbnb;
 *   2. Admin › Sistema lista a chave PRECO_JUSTO_COMPARADOR (NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR) como "Desligada";
 *   3. (pacote 3, #2132) a ficha pública do anúncio NÃO mostra a comparação com 30 noites no Airbnb
 *      (ficha-comparacao-airbnb) — nem num anúncio ativo do laboratório.
 * A comparação com a chave ligada (cotação simulada, link inválido) fica com os testes de unidade do #2105; quando a
 * chave ligar, esta spec muda junto (o caso 1 passa a conferir o campo).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t971.${sufixo}@lab.vivanomads.test`, nome: "Paulo Preço", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T971 — E399-C: o comparador do Preço justo fica desligado atrás da chave", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [390, 1280]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Preço Justo ${w} ${sufixo}`);
    ids.publicado = await criarImovelPronto(ids.dono, `Studio Preço Justo publicado ${sufixo}`, { ativo: true, preco: 3200 });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`Passo 8 sem o campo do link do Airbnb (${w})`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids[`r${w}`], "preco", w);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("campo-link-airbnb")).toHaveCount(0);
      await expect(page.getByTestId("link-airbnb")).toHaveCount(0);
      await expect(page.getByTestId("comparacao-airbnb")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });

    test(`ficha pública sem a comparação com o Airbnb (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.publicado}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("ficha-comparacao-airbnb")).toHaveCount(0);
      await expect(page.getByTestId("ficha-comparacao-simulada")).toHaveCount(0);
      await ctx.close();
    });

    test(`Admin › Sistema: PRECO_JUSTO_COMPARADOR "Desligada" (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      const chave = page.locator('[data-testid="chave-ambiente"][data-nome="PRECO_JUSTO_COMPARADOR"]');
      await expect(chave).toBeVisible({ timeout: 30_000 });
      await expect(chave).toContainText('Selo "Preço justo" pelo link do Airbnb'); // o fim do rótulo mudou no pacote 1 ("dados simulados")
      await expect(chave).toContainText("NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR");
      await expect(chave.locator("[data-ligada]")).toHaveAttribute("data-ligada", "0");
      await expect(chave.locator("[data-ligada]")).toHaveText("Desligada");
      await ctx.close();
    });
  }
});
