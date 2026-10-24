import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T285 — Datas flexíveis na busca (Prompt 55, parte B2). Três imóveis num bairro só deste teste, para a entrada D:
 *   livre desde D-5 · livre em D+10 · livre em D+20.
 *  1. Sem flexibilidade: só o livre antes da entrada; a folha mostra "Entrada em …" e "Mostrar 1 imóvel".
 *  2. "Datas flexíveis (até 15 dias depois)": a folha conta 2 antes de aplicar; aplicado, a lista tem os 2 (D+20 fica de
 *     fora) e a URL leva flex=1.
 *  3. Sem data de entrada, a folha não mostra a opção.
 * A /buscar guarda cache de 60 s: o primeiro passo espera os imóveis novos entrarem.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t285.${sufixo}@lab.vivanomads.test`, nome: "Flávia Datas", role: "owner" as const };
const BAIRRO = `Bairro T285 ${sufixo}`;
const ids: { dono?: string; antes?: string; d10?: string; d20?: string } = {};

const dia = (n: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ENTRADA = dia(30);
const busca = (q = "") => `/buscar?local=${encodeURIComponent(BAIRRO)}${q}`;
const cards = (page: Page) => page.getByTestId("grade-resultados").getByTestId("card-resultado");

async function abrirFolha(page: Page) {
  await page.getByTestId("abrir-filtros").click();
  return page.getByRole("dialog", { name: "Filtros" });
}

test.describe("T285 — busca com datas flexíveis", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const livre = { antes: dia(25), d10: dia(40), d20: dia(50) } as const;
    for (const k of ["antes", "d10", "d20"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, `Studio datas ${k} ${sufixo}`, { ativo: true, preco: 2500 });
      const { error } = await adm().from("properties").update({ address: BAIRRO, available_from: livre[k] }).eq("id", ids[k]!);
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. sem flexibilidade: só o livre antes da entrada", async ({ page }) => {
    test.setTimeout(120_000);
    await expect(async () => {
      await page.goto(busca(), { waitUntil: "domcontentloaded" });
      await expect(cards(page)).toHaveCount(3, { timeout: 5_000 });
    }).toPass({ intervals: [2_000, 5_000, 10_000], timeout: 90_000 });
    await page.goto(busca(`&entrada=${ENTRADA}`), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(cards(page).first()).toHaveAttribute("data-id", ids.antes!);
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("painel-datas")).toContainText(`Entrada em ${ENTRADA.split("-").reverse().join("/")}`);
    await expect(folha.getByTestId("aplicar-filtros")).toHaveText("Mostrar 1 imóvel");
  });

  test("2. 'Datas flexíveis': a folha conta 2 e a lista bate", async ({ page }) => {
    await page.goto(busca(`&entrada=${ENTRADA}`), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(1, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    await folha.getByTestId("painel-datas").getByRole("button", { name: "Datas flexíveis (até 15 dias depois)", exact: true }).click();
    const aplicar = folha.getByTestId("aplicar-filtros");
    await expect(aplicar).toHaveText("Mostrar 2 imóveis");
    await folha.screenshot({ path: "tests/laboratorio/saida/t285-folha-datas-390.png" });
    await aplicar.click();
    await expect(page).toHaveURL(/flex=1/);
    await expect(cards(page)).toHaveCount(2);
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.d20}"]`)).toHaveCount(0);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });

  test("3. sem data de entrada, a folha não mostra a opção", async ({ page }) => {
    await page.goto(busca("&flex=1"), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(3, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("painel-datas")).toHaveCount(0);
  });
});
