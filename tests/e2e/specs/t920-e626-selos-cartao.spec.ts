import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T920 — E626 (estudo de selos aprovado pelo Daniel, 06/11; substitui a t920 do E416): o cartão mostra no máximo 2 pílulas
  sobre a foto — a do nível em palavra (na cor do nível) e a branca só de símbolos (preço justo, pets, negociação; o
  verificado depende da conta do dono). Três anúncios do mesmo dono: TODOS (Conforto + os 3 símbolos), SÓ NÍVEL (Premium)
  e NENHUM. Vitrine (página pública do proprietário: o mesmo PropertyCard da busca) e Meus anúncios, a 390 e 1280:
  as pílulas certas, cada símbolo com aria-label e title (o leitor de tela lê os nomes), nada sobre o coração (também com o
  cartão estreito de 169 px do celular em 2 colunas) e sem rolagem lateral; "sem selo" não desenha a fileira.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t920.${sufixo}@lab.vivanomads.test`, nome: "Selma Selos", role: "owner" as const };
const ids: Record<string, string> = {};
const T = { todos: `Todos os selos t920 ${sufixo}`, nivel: `So nivel t920 ${sufixo}`, nenhum: `Sem selo t920 ${sufixo}` };

async function selosDe(cartao: Locator) {
  return cartao.locator('[data-testid="selos-foto"] [data-selo]').evaluateAll((els) => els.map((e) => e.getAttribute("data-selo")));
}
async function pilulasDe(cartao: Locator) {
  return Number(await cartao.getByTestId("selos-foto").getAttribute("data-pilulas"));
}
async function nadaSobreOCoracao(cartao: Locator) {
  return cartao.evaluate((el) => {
    const cor = el.querySelector('[data-testid="coracao"]')?.getBoundingClientRect();
    if (!cor) return 0;
    return [...el.querySelectorAll('[data-testid="selos-foto"] [data-selo], [data-testid="card-nivel"]')].filter((s) => {
      const r = s.getBoundingClientRect();
      return !(r.right <= cor.left || r.left >= cor.right || r.bottom <= cor.top || r.top >= cor.bottom);
    }).length;
  });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe("T920 — E626: selos do cartão (nível + símbolos)", () => {
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
      // Todos: 2 pílulas — o nível Conforto (verde-marca, texto branco) e os 3 símbolos, nesta ordem.
      expect(await pilulasDe(cartao(T.todos))).toBe(2);
      expect(await selosDe(cartao(T.todos))).toEqual(["precoJusto", "pets", "negocia"]);
      const nivelTodos = cartao(T.todos).getByTestId("card-nivel");
      await expect(nivelTodos).toHaveText("Conforto");
      expect(await nivelTodos.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(28, 107, 58)");
      expect(await nivelTodos.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(255, 255, 255)");
      // Leitor de tela: cada símbolo tem nome (aria-label) e title com o texto completo.
      const grupo = cartao(T.todos).getByTestId("selos-simbolos");
      await expect(grupo).toHaveAttribute("aria-label", "Selos do anúncio");
      for (const [id, nome] of [["selo-preco-justo", "Preço justo"], ["selo-pets", "Aceita pets"], ["cartao-negocia", "Aceita negociação"]] as const) {
        const simbolo = grupo.getByTestId(id);
        await expect(simbolo).toHaveAttribute("aria-label", nome);
        await expect(simbolo).toHaveAttribute("title", nome);
      }
      expect(await nadaSobreOCoracao(cartao(T.todos)), "selo sobre o coração").toBe(0);
      // Cartão estreito (celular em 2 colunas, 169 px): nada sobre o coração.
      await cartao(T.todos).evaluate((el) => ((el as HTMLElement).style.width = "169px"));
      expect(await nadaSobreOCoracao(cartao(T.todos)), "selo sobre o coração no cartão estreito").toBe(0);
      await cartao(T.todos).evaluate((el) => ((el as HTMLElement).style.width = ""));
      // Só nível: 1 pílula, Premium (preto-marca).
      expect(await pilulasDe(cartao(T.nivel))).toBe(1);
      expect(await selosDe(cartao(T.nivel))).toEqual([]);
      const nivelPremium = cartao(T.nivel).getByTestId("card-nivel");
      await expect(nivelPremium).toHaveText("Premium");
      expect(await nivelPremium.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(10, 10, 10)");
      // Nenhum: a fileira nem é desenhada.
      await expect(cartao(T.nenhum).getByTestId("selos-foto")).toHaveCount(0);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await cartao(T.todos).scrollIntoViewIfNeeded();
      await cartao(T.todos).screenshot({ path: `${SAIDA}/t920-vitrine-2pilulas-${w}.png` });
      await cartao(T.nivel).screenshot({ path: `${SAIDA}/t920-vitrine-so-nivel-${w}.png` });
      await cartao(T.nenhum).screenshot({ path: `${SAIDA}/t920-vitrine-nenhum-${w}.png` });

      // Meus anúncios: a mesma fileira sobre a foto (sem coração aqui).
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const meu = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(meu(ids.todos)).toBeVisible({ timeout: 30_000 });
      expect(await pilulasDe(meu(ids.todos))).toBe(2);
      expect(await selosDe(meu(ids.todos))).toEqual(["precoJusto", "pets", "negocia"]);
      expect(await pilulasDe(meu(ids.nivel))).toBe(1);
      await expect(meu(ids.nenhum).getByTestId("selos-foto")).toHaveCount(0);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await meu(ids.todos).screenshot({ path: `${SAIDA}/t920-meus-2pilulas-${w}.png` });

      // Página do imóvel: a lista completa, símbolo + texto (o bloco do nível segue como está).
      await p.goto(`/imoveis/${ids.todos}`, { waitUntil: "domcontentloaded" });
      const lista = p.getByTestId("selos-anuncio");
      await expect(lista).toBeVisible({ timeout: 30_000 });
      for (const t of ["Preço justo", "Aceita pets", "Aceita negociação"]) await expect(lista).toContainText(t);
      expect(await semRolagemLateral(p)).toBeLessThanOrEqual(1);
      await lista.screenshot({ path: `${SAIDA}/t920-pagina-selos-${w}.png` });
      await ctx.close();
    });
  }
});
