import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1145 — E521 (#2583, 05/11): /comparar abre com o "Total por mês (com contas)" — a MESMA base da busca e do anúncio —
 * e o aluguel vem à parte, rotulado "Aluguel (só o valor mensal)". Antes a primeira linha era só o aluguel, e o
 * comparar dizia R$ 2.000 onde a busca dizia R$ 2.430. Dois anúncios com condomínio, numa cidade só do teste, 390 e 1280:
 *   1. a primeira linha da tabela é a do total; a segunda é a do aluguel;
 *   2. o total de cada coluna é IGUAL ao preço do cartão do mesmo anúncio na busca e MAIOR que o aluguel;
 *   3. a tabela não estoura a página.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Comparópolis ${sufixo}`;
const dono = { email: `dono.t1145.${sufixo}@lab.vivanomads.test`, nome: "Cora Comparar", role: "owner" as const };
const ids: { dono?: string; a?: string; b?: string } = {};
const TITULO = { a: `Studio comparar A ${sufixo}`, b: `Studio comparar B ${sufixo}` };
const reais = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

/** O preço do cartão na busca da cidade do teste (a busca fica em cache por até 60 s: recarrega até o anúncio aparecer). */
async function precoDoCartao(page: Page, titulo: string): Promise<string> {
  const cartao = page.getByTestId("cartao-imovel").filter({ hasText: titulo });
  await expect(async () => {
    await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
    await expect(cartao).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  return (await cartao.getByTestId("cartao-preco-mes").innerText()).trim();
}

test.describe("T1145 — E521: o comparar mostra o total por mês da busca, com o aluguel à parte", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, TITULO.a, { ativo: true, preco: 2000 });
    ids.b = await criarImovelPronto(ids.dono, TITULO.b, { ativo: true, preco: 2600 });
    const { error: eA } = await adm().from("properties").update({ city: CIDADE, condo_fee: 430 }).eq("id", ids.a);
    expect(eA, eA?.message).toBeNull();
    const { error: eB } = await adm().from("properties").update({ city: CIDADE, condo_fee: 350 }).eq("id", ids.b);
    expect(eB, eB?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`total por mês igual ao do cartão e o aluguel à parte (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const cartao = { a: await precoDoCartao(page, TITULO.a), b: await precoDoCartao(page, TITULO.b) };

        await page.goto(`/comparar?comparar=${ids.a},${ids.b}`, { waitUntil: "domcontentloaded" });
        const tabela = page.getByTestId("comparar-tabela");
        await expect(tabela).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
        const linhas = tabela.locator("tbody tr");
        await expect(linhas.nth(0)).toHaveAttribute("data-linha", "total");
        await expect(linhas.nth(0).getByRole("rowheader")).toHaveText("Total por mês (com contas)");
        await expect(linhas.nth(1)).toHaveAttribute("data-linha", "mensal");
        await expect(linhas.nth(1).getByRole("rowheader")).toHaveText("Aluguel (só o valor mensal)");

        const total = (await tabela.locator('[data-linha="total"] td').allInnerTexts()).map((s) => s.trim());
        const aluguel = (await tabela.locator('[data-linha="mensal"] td').allInnerTexts()).map((s) => s.trim());
        expect(reais(total[0]), `A: comparar ${total[0]} × cartão ${cartao.a}`).toBe(reais(cartao.a));
        expect(reais(total[1]), `B: comparar ${total[1]} × cartão ${cartao.b}`).toBe(reais(cartao.b));
        expect(reais(aluguel[0])).toBe(2000);
        expect(reais(aluguel[1])).toBe(2600);
        expect(reais(total[0])).toBeGreaterThan(reais(aluguel[0]));
        expect(reais(total[1])).toBeGreaterThan(reais(aluguel[1]));

        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
