import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T913 — E416 (ordem do Daniel, 05/11): os selos do cartão empilhados sobre a foto, cada um com ícone + texto. Três anúncios
  do mesmo dono: TODOS (Preço justo + Aceita pets + nível Conforto + Aceita negociação), SÓ NÍVEL (Premium) e NENHUM.
  Vitrine (página pública do proprietário: o mesmo PropertyCard da busca) e Meus anúncios, a 390 e 1280: os selos certos,
  na ordem do pedido, nenhum sobre o coração e sem rolagem lateral; o "sem selo" não desenha a fileira.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t913.${sufixo}@lab.vivanomads.test`, nome: "Selma Selos", role: "owner" as const };
const ids: Record<string, string> = {};
const T = { todos: `Todos os selos t913 ${sufixo}`, nivel: `So nivel t913 ${sufixo}`, nenhum: `Sem selo t913 ${sufixo}` };

async function selosDe(cartao: Locator) {
  return cartao.locator('[data-testid="selos-foto"] [data-selo]').evaluateAll((els) => els.map((e) => e.getAttribute("data-selo")));
}
async function nadaSobreOCoracao(cartao: Locator) {
  return cartao.evaluate((el) => {
    const cor = el.querySelector('[data-testid="coracao"]')?.getBoundingClientRect();
    if (!cor) return 0;
    return [...el.querySelectorAll('[data-testid="selos-foto"] [data-selo]')].filter((s) => {
      const r = s.getBoundingClientRect();
      return !(r.right <= cor.left || r.left >= cor.right || r.bottom <= cor.top || r.top >= cor.bottom);
    }).length;
  });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe("T913 — E416: selos empilhados no cartão", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.todos = await criarImovelPronto(ids.dono, T.todos, { ativo: true, preco: 2000 });
    ids.nivel = await criarImovelPronto(ids.dono, T.nivel, { ativo: true, preco: 2100 });
    ids.nenhum = await criarImovelPronto(ids.dono, T.nenhum, { ativo: true, preco: 2200 });
    const muda = async (id: string, campos: Record<string, unknown>) => {
      const { error } = await adm().from("properties").update(campos).eq("id", id);
      if (error) throw error;
    };
    await muda(ids.todos, { airbnb_monthly_price: 20000, pets_allowed: true, negociacao: { aceita: true, itens: ["valor_mensal"], descontos: [] } });
    await muda(ids.nivel, { airbnb_monthly_price: null, pets_allowed: false, negociacao: null });
    await muda(ids.nenhum, { airbnb_monthly_price: null, pets_allowed: false, negociacao: null });
    const { error } = await adm().from("imovel_nivel").upsert([
      { property_id: ids.todos, nivel: "conforto" },
      { property_id: ids.nivel, nivel: "premium" },
    ]);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: vitrine (página do proprietário) e Meus anúncios`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);

      // Vitrine: o mesmo PropertyCard da busca.
      await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const cartao = (t: string) => p.getByTestId("cartao-imovel").filter({ hasText: t }).first();
      await expect(cartao(T.todos)).toBeVisible({ timeout: 30_000 });
      expect(await selosDe(cartao(T.todos))).toEqual(["precoJusto", "pets", "nivel", "negocia"]);
      await expect(cartao(T.todos).getByTestId("card-nivel")).toContainText("Conforto");
      await expect(cartao(T.todos).getByTestId("cartao-negocia")).toContainText("Aceita negociação");
      expect(await nadaSobreOCoracao(cartao(T.todos)), "selo sobre o coração").toBe(0);
      expect(await selosDe(cartao(T.nivel))).toEqual(["nivel"]);
      await expect(cartao(T.nivel).getByTestId("card-nivel")).toContainText("Premium");
      await expect(cartao(T.nenhum).getByTestId("selos-foto")).toHaveCount(0);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await cartao(T.todos).scrollIntoViewIfNeeded();
      await cartao(T.todos).screenshot({ path: `${SAIDA}/t913-vitrine-4selos-${w}.png` });

      // Meus anúncios: a mesma fileira sobre a foto (sem coração aqui); o nível saiu da fileira de pílulas.
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const meu = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(meu(ids.todos)).toBeVisible({ timeout: 30_000 });
      expect(await selosDe(meu(ids.todos))).toEqual(["precoJusto", "pets", "nivel", "negocia"]);
      expect(await selosDe(meu(ids.nivel))).toEqual(["nivel"]);
      await expect(meu(ids.nenhum).getByTestId("selos-foto")).toHaveCount(0);
      await expect(p.getByTestId("anuncio-nivel")).toHaveCount(0);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await meu(ids.todos).screenshot({ path: `${SAIDA}/t913-meus-4selos-${w}.png` });
      await ctx.close();
    });
  }
});
