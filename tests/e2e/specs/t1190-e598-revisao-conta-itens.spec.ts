import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1190 — E598 (#2716, 05/11): o cartão de Meus imóveis listava 6 itens em "Falta para publicar" e a Revisão do mesmo
 * rascunho dizia "Faltam 4 itens" — a Revisão contava as LINHAS da lista de conferência (um passo com dois itens faltando
 * contava 1). Agora conta os itens. O E598 entrou só com teste de unidade; aqui é a tela, a 390 e 1280, com um rascunho
 * do laboratório sem fotos e quase sem dados (vários itens faltando, alguns no mesmo passo):
 *   1. no cartão de Meus imóveis, N = quantos atalhos "Falta para publicar" o rascunho tem;
 *   2. na Revisão do mesmo rascunho, o motivo do "Publicar" travado diz "Faltam N itens antes de publicar" — o mesmo N
 *      (a lista de conferência mostra os mesmos itens).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1190.${sufixo}@lab.vivanomads.test`, nome: "Paula Pendente", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1190 — E598: a Revisão conta os mesmos itens que o cartão de Meus imóveis", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`"Faltam N itens" na Revisão = os N atalhos do cartão (${w})`, async ({ browser }) => {
      const titulo = `Rascunho incompleto t1190 ${w} ${sufixo}`;
      const imovel = await criarImovelPronto(ids.dono!, titulo);
      // Sem fotos e sem descrição, preço e regras: vários itens faltando, mais de um no mesmo passo.
      expect((await adm().from("property_photos").delete().eq("property_id", imovel)).error).toBeNull();
      expect((await adm().from("properties").update({ description: "", monthly_price: 0, draft_data: { title: titulo, photos: [] } }).eq("id", imovel)).error).toBeNull();

      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
        const cartao = p.locator(`[data-testid="meu-anuncio"][data-imovel="${imovel}"]`);
        const falta = cartao.getByTestId("falta-publicar");
        await expect(falta).toBeVisible({ timeout: 30_000 });
        const atalhos = await falta.locator('a[data-testid^="pendencia-"]').evaluateAll((as) => as.map((a) => a.textContent?.trim() ?? ""));
        const n = atalhos.length;
        expect(n, `itens do cartão: ${atalhos.join(" · ")}`).toBeGreaterThanOrEqual(2);

        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("etapa-revisar")).toBeVisible({ timeout: 30_000 });
        const motivo = p.getByTestId("publicar-motivo").first();
        await expect(motivo).toContainText(/Faltam? \d+ ite(m|ns) antes de publicar/, { timeout: 20_000 });
        const naRevisao = Number((await motivo.innerText()).match(/Faltam? (\d+) ite/)![1]);
        expect(naRevisao, `Revisão: "${await motivo.innerText()}"; cartão: ${atalhos.join(" · ")}`).toBe(n);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
