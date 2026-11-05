import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T268 — D-V7 da t249: em Meus imóveis, só o anúncio no ar aponta para a página pública (título, foto e "Ver").
 * E510: no rascunho, título e foto também são links — para o passo a passo, o mesmo destino de "Continuar editando"
 * (nunca para a página pública, que daria 404). Nenhum link dá 404. 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t268.${sufixo}@lab.vivanomads.test`, nome: "Dora Links", role: "owner" as const };
const ids: { dono?: string; ativo?: string; rascunho?: string } = {};
const ATIVO = `Studio no ar ${sufixo}`;
const RASCUNHO = `Studio em rascunho ${sufixo}`;

test.describe("T268 — Meus imóveis: links só para página que existe", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria conta e imóveis).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativo = await criarImovelPronto(ids.dono, ATIVO, { ativo: true });
    ids.rascunho = await criarImovelPronto(ids.dono, RASCUNHO, { ativo: false });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura}px — só o anúncio no ar aponta para a página pública; rascunho leva ao passo a passo`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });

      const tituloAtivo = page.getByRole("link", { name: ATIVO, exact: true });
      await expect(tituloAtivo).toHaveAttribute("href", `/imoveis/${ids.ativo}`, { timeout: 25_000 });
      await expect(page.locator(`a[href="/imoveis/${ids.ativo}"]`, { hasText: "Ver" })).toHaveCount(1);
      // E510: o título do rascunho é link — para o passo a passo, nunca para a página pública (404).
      const tituloRascunho = page.getByRole("link", { name: RASCUNHO, exact: true });
      await expect(tituloRascunho).toHaveAttribute("href", new RegExp(`^/dashboard/imoveis/novo\\?draft=${ids.rascunho}`));
      await expect(page.locator(`a[href="/imoveis/${ids.rascunho}"]`)).toHaveCount(0);
      // E510: a foto de cada cartão leva ao mesmo destino do título.
      for (const id of [ids.ativo, ids.rascunho]) {
        const cartao = page.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
        const foto = await cartao.getByTestId("cartao-foto-link").getAttribute("href");
        expect(foto).toBe(await cartao.getByTestId("cartao-titulo-link").getAttribute("href"));
      }
      // E507: "Continuar editando" abre o rascunho no 1º passo que falta (o mesmo destino do Início).
      await expect(page.locator(`a[href^="/dashboard/imoveis/novo?draft=${ids.rascunho}"]`, { hasText: "Continuar editando" })).toHaveCount(1);

      const r = await page.request.get(`/imoveis/${ids.ativo}`);
      expect(r.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.close();
    });
  }
});
