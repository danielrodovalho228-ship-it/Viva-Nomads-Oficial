import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1170 — E556 (#2647, 05/11): a completude do rascunho vem de UMA fonte (o draft_data) no cartão de Meus imóveis e no
 * editor. Reprova de 05/11: o cartão dizia 50% com "Garantia aceita" a fazer e a revisão 57% sem ela —
 * garantias_aceitas=[] na COLUNA e caução marcada no draft_data. Algumas escolhas só vão para as colunas ao publicar; o
 * cartão lia as colunas. O E556 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com dois rascunhos do mesmo
 * dono, ambos com garantias_aceitas=[] na coluna:
 *   1. rascunho A, com a caução marcada no draft_data: o cartão NÃO pede "Garantia aceita" (pendencia-garantia ausente);
 *   2. rascunho B (controle), sem garantia marcada no draft_data: o cartão pede (pendencia-garantia presente);
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1170.${sufixo}@lab.vivanomads.test`, nome: "Lia Rascunhos", role: "owner" as const };
const TITULO = { a: `Rascunho com caução ${sufixo}`, b: `Rascunho sem garantia ${sufixo}` };
const ids: { dono?: string; a?: string; b?: string } = {};

test.describe("T1170 — E556: o cartão do rascunho lê a garantia do draft_data, como o editor", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, TITULO.a);
    ids.b = await criarImovelPronto(ids.dono, TITULO.b);
    for (const [id, garantias] of [[ids.a, { caucao_avista: true }], [ids.b, { caucao_avista: false }]] as const) {
      const { error } = await adm().from("properties").update({ garantias_aceitas: [], draft_data: { title: id === ids.a ? TITULO.a : TITULO.b, garantias } }).eq("id", id);
      expect(error, error?.message).toBeNull();
    }
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`caução no draft_data: sem pendência de garantia; sem nada marcado: com (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
        const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
        await expect(cartao(ids.a!).getByTestId("prontidao")).toBeVisible({ timeout: 30_000 });
        await expect(cartao(ids.b!).getByTestId("prontidao")).toBeVisible();
        await expect(cartao(ids.a!).getByTestId("pendencia-garantia"), "caução marcada no draft_data").toHaveCount(0);
        await expect(cartao(ids.b!).getByTestId("pendencia-garantia"), "nenhuma garantia marcada").toHaveCount(1);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
