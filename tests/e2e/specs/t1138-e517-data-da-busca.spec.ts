import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1138 — E517 (#2561, 05/11): a data de entrada que vem da BUSCA (a última busca guardada no aparelho,
 * `vn:ultima-busca`) só pré-seleciona no anúncio se couber nele. Antes, uma busca de 15/11 marcava 15/11 num anúncio que
 * só aceita a partir de 21/11. Entrou com o e517-data-da-busca.test.ts; aqui é a página real de um anúncio do laboratório
 * disponível só daqui a 30 dias, como visitante, 390 e 1280:
 *   1. busca para daqui a 10 dias → a entrada do cartão fica VAZIA e o aviso aviso-data-busca diz a primeira data;
 *   2. busca para daqui a 35 dias (dentro da disponibilidade) → a entrada vem pré-selecionada e não há aviso.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1138.${sufixo}@lab.vivanomads.test`, nome: "Caio Data Busca", role: "owner" as const };
const ids: Record<string, string> = {};
// Datas no calendário de Brasília (o anúncio e a busca usam o dia local).
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");

async function abrirComBusca(browser: Browser, w: number, inicio: string) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
  await ctx.addInitScript((v) => window.localStorage.setItem("vn:ultima-busca", v), JSON.stringify({ inicio, meses: 1, pessoas: 1 }));
  const page = await ctx.newPage();
  await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  return { ctx, page, card: page.locator("#cartao-preco") };
}

test.describe("T1138 — E517: a data da busca indisponível não fica pré-selecionada no anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio disponível depois E517 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ available_from: dia(30), available_until: null, min_period_days: 30 }).eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`busca antes da disponibilidade: entrada vazia e o aviso com a primeira data (${w})`, async ({ browser }) => {
      const { ctx, page, card } = await abrirComBusca(browser, w, dia(10));
      try {
        const aviso = page.getByTestId("aviso-data-busca");
        await expect(aviso).toBeVisible({ timeout: 20_000 });
        await expect(aviso).toContainText(`A data da sua busca (${br(dia(10))}) não está disponível neste imóvel: a entrada é a partir de ${br(dia(30))}.`);
        await expect(card.getByTestId("candidatura-inicio")).toHaveValue("");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });

    test(`busca dentro da disponibilidade: a entrada vem pré-selecionada, sem aviso (${w})`, async ({ browser }) => {
      const { ctx, page, card } = await abrirComBusca(browser, w, dia(35));
      try {
        await expect(card.getByTestId("candidatura-inicio")).toHaveValue(br(dia(35)), { timeout: 20_000 });
        await expect(page.getByTestId("aviso-data-busca")).toHaveCount(0);
      } finally {
        await ctx.close();
      }
    });
  }
});
