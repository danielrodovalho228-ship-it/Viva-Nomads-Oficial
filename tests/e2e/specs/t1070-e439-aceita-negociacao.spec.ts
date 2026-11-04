import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1070 — E439 (#2386, 04/11): "Aceita negociação" na busca. Dois imóveis num bairro só deste teste, um com
 * properties.negociacao.aceita = true e outro sem negociação. Pela tela real, visitante:
 *   1. sem o filtro (390 e 1280): os dois aparecem; só o que negocia traz "Aceita negociação" no cartão;
 *   2. a folha de filtros (390): a faceta "Aceita negociação" → "Mostrar 1 imóvel" → a URL ganha negocia=1 e a lista
 *      fica só com o que negocia;
 *   3. pela URL (?negocia=1, 1280): só o que negocia; sem o parâmetro, os dois de volta.
 * O critério (passaNoPainel, contagem e resumo) fica com o e439-aceita-negociacao.test.ts.
 * A /buscar guarda cache de 60 s: o primeiro passo espera os imóveis novos entrarem.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1070.${sufixo}@lab.vivanomads.test`, nome: "Nestor Negocia Prado", role: "owner" as const };
const BAIRRO = `Bairro T1070 ${sufixo}`;
const ids: Record<"dono" | "negocia" | "fixo", string | undefined> = { dono: undefined, negocia: undefined, fixo: undefined };
const TITULOS = { negocia: `Studio que negocia ${sufixo}`, fixo: `Studio de preço fixo ${sufixo}` };

const busca = (q = "") => `/buscar?local=${encodeURIComponent(BAIRRO)}${q}`;
const cards = (page: Page) => page.getByTestId("grade-resultados").getByTestId("card-resultado");
const sobra = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T1070 — E439: Aceita negociação no cartão e no filtro da busca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const k of ["negocia", "fixo"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, TITULOS[k], { ativo: true, preco: 2600 });
      const negociacao = k === "negocia" ? { aceita: true, itens: [], descontos: [] } : null;
      const { error } = await adm().from("properties").update({ address: BAIRRO, negociacao }).eq("id", ids[k]!);
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. sem o filtro: os dois; só o que negocia traz o rótulo no cartão (${w})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await expect(async () => {
        await page.goto(busca(), { waitUntil: "domcontentloaded" });
        await expect(cards(page)).toHaveCount(2, { timeout: 5_000 });
      }).toPass({ intervals: [2_000, 5_000, 10_000], timeout: 90_000 });
      const cartao = (id: string) => page.getByTestId("grade-resultados").locator(`[data-testid="card-resultado"][data-id="${id}"]`);
      await expect(cartao(ids.negocia!).getByTestId("cartao-negocia")).toHaveText("Aceita negociação");
      const fixo = cartao(ids.fixo!);
      await expect(fixo).toBeVisible();
      await expect(fixo.getByTestId("cartao-negocia")).toHaveCount(0);
      expect(await sobra(page)).toBeLessThanOrEqual(1);
    });
  }

  test("2. a folha: a faceta 'Aceita negociação' → Mostrar 1 imóvel → negocia=1 e só o que negocia (390)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(busca(), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
    await page.getByTestId("pilula-mais").click();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    const faceta = folha.getByTestId("faceta-negocia");
    await expect(faceta).toContainText("Aceita negociação");
    await faceta.click();
    const aplicar = folha.getByTestId("aplicar-filtros");
    await expect(aplicar).toHaveText("Mostrar 1 imóvel");
    await aplicar.click();
    await expect(page).toHaveURL(/negocia=1/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toHaveAttribute("data-id", ids.negocia!);
    expect(await sobra(page)).toBeLessThanOrEqual(1);
  });

  test("3. pela URL: ?negocia=1 só o que negocia; sem o parâmetro, os dois (1280)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(busca("&negocia=1"), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(cards(page).first()).toHaveAttribute("data-id", ids.negocia!);
    await page.goto(busca(), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
  });
});
