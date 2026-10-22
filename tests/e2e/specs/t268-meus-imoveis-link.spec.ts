import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T268 — D-V da t249: em Meus imóveis, o anúncio ativo leva à página pública e tem "Ver"; o rascunho leva à edição,
 * não tem "Ver" e nenhum clique abre página 404. 390 e 1280 px.
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
    test(`${largura}px — ativo abre a página pública; rascunho abre a edição`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });

      const tituloAtivo = page.getByRole("link", { name: ATIVO, exact: true });
      const tituloRascunho = page.getByRole("link", { name: RASCUNHO, exact: true });
      await expect(tituloAtivo).toHaveAttribute("href", `/imoveis/${ids.ativo}`, { timeout: 25_000 });
      await expect(tituloRascunho).toHaveAttribute("href", `/dashboard/imoveis/${ids.rascunho}/editar`);
      await expect(page.locator(`a[href="/imoveis/${ids.rascunho}"]`)).toHaveCount(0);
      await expect(page.locator(`a[href="/imoveis/${ids.ativo}"]`, { hasText: "Ver" })).toHaveCount(1);

      const r = await page.request.get(`/imoveis/${ids.ativo}`);
      expect(r.status()).toBe(200);
      await tituloRascunho.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.rascunho}/editar`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.close();
    });
  }
});
