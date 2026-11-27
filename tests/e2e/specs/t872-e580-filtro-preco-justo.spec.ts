import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T872 — E580: o filtro "Preço justo" existe na folha da /buscar (grupo Contrato), com a chave PRECO_JUSTO_COMPARADOR
 * desligada (como em produção). Fixture numa cidade única: A com o selo (Airbnb informado bem acima do total → coluna
 * preco_justo = true), B sem. Prova: o chip conta 1 = os cards com o selo; ligado, a lista fica só com A e a URL leva
 * ?precojusto=1; numa cidade sem selo o chip mostra 0 e fica desabilitado (não some). 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Preco Justo ${sufixo}`;
const CIDADE_SEM = `Cidade Sem Selo ${sufixo}`;
const dono = { email: `dono.t872.${sufixo}@lab.vivanomads.test`, nome: "Dora Selo", role: "owner" as const };
const ids: { dono?: string; a?: string; b?: string; c?: string } = {};

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}

test.describe("T872 — E580: filtro Preço justo na /buscar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, `Com Selo ${sufixo}`, { ativo: true, preco: 2000 });
    ids.b = await criarImovelPronto(ids.dono, `Sem Selo ${sufixo}`, { ativo: true, preco: 2100 });
    ids.c = await criarImovelPronto(ids.dono, `Outra Cidade ${sufixo}`, { ativo: true, preco: 2200 });
    const muda = async (id: string, campos: Record<string, unknown>) => {
      const { error } = await adm().from("properties").update(campos).eq("id", id);
      if (error) throw error;
    };
    await muda(ids.a, { city: CIDADE, airbnb_monthly_price: 20000 });
    await muda(ids.b, { city: CIDADE, airbnb_monthly_price: null });
    await muda(ids.c, { city: CIDADE_SEM, airbnb_monthly_price: null });
    const { data } = await adm().from("properties").select("id, preco_justo").in("id", [ids.a, ids.b]);
    expect(Object.fromEntries((data ?? []).map((r) => [r.id, r.preco_justo]))).toEqual({ [ids.a]: true, [ids.b]: false });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`a ${largura}px: o chip conta os cards com o selo e filtra`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const folha = await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE)}`);
      const chip = folha.getByTestId("faceta-selo-preco-justo");
      await expect(chip).toBeVisible();
      await expect(chip).toContainText("Preço justo");
      await expect(chip).toHaveAttribute("data-n", "1");
      await expect(chip).toBeEnabled();
      await chip.click();
      await folha.getByTestId("aplicar-filtros").click();
      await expect(page).toHaveURL(/precojusto=1/);
      await expect(page.getByTestId("selo-preco-justo")).toHaveCount(1);
      await expect(page.locator("main")).toContainText(`Com Selo ${sufixo}`);
      await expect(page.locator("main")).not.toContainText(`Sem Selo ${sufixo}`);
      await page.screenshot({ path: `tests/laboratorio/saida/t872-preco-justo-${largura}.png`, fullPage: true });
    });
  }

  test("cidade sem selo: o chip aparece com 0 e desabilitado", async ({ page }) => {
    const folha = await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE_SEM)}`);
    const chip = folha.getByTestId("faceta-selo-preco-justo");
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("data-n", "0");
    await expect(chip).toBeDisabled();
  });
});
