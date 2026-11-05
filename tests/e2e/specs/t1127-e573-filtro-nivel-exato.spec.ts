import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1127 — E573 (#2538, 04/11): filtro por nível EXATO na busca (`?niveis=`), decisão do Daniel de 04/11 — devolve os
 * anúncios com AQUELE nível (não "a partir de"); mais de um nível soma; anúncio sem nível definido não entra em filtro de
 * nível nenhum; valor inválido cai. Entrou com o e573-filtro-nivel.test.ts; o rótulo/posição do grupo no painel é da
 * Pista A, então aqui a escolha vai pela URL e o resultado é lido no "Aplicar" da folha de filtros (o total que a busca
 * entrega, como a t350). Numa cidade só do teste, 4 anúncios ativos: Essencial, Conforto, Premium e um sem nível; 390 e
 * 1280:
 *   sem filtro → 4 · niveis=conforto → 1 · niveis=conforto,premium → 2 · niveis=essencial → 1 · niveis=xyz → 4.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Niveis ${sufixo}`;
const dono = { email: `dono.t1127.${sufixo}@lab.vivanomads.test`, nome: "Rui Nível Matos", role: "owner" as const };
const ids: Record<string, string> = {};

async function totalDaFolha(page: Page, url: string): Promise<number> {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", /\d+/, { timeout: 15_000 });
  return Number(await page.getByTestId("aplicar-filtros").getAttribute("data-total"));
}

test.describe("T1127 — E573: o filtro de nível da busca é exato, soma níveis e deixa de fora o anúncio sem nível", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const k of ["essencial", "conforto", "premium", "sem"] as const) ids[k] = await criarImovelPronto(ids.dono, `Studio nível ${k} ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.essencial, ids.conforto, ids.premium, ids.sem]);
    expect(error, error?.message).toBeNull();
    const { error: eNivel } = await adm()
      .from("imovel_nivel")
      .upsert(["essencial", "conforto", "premium"].map((nivel) => ({ property_id: ids[nivel], nivel })), { onConflict: "property_id" });
    expect(eNivel, eNivel?.message).toBeNull();
    await adm().from("imovel_nivel").delete().eq("property_id", ids.sem);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`?niveis= exato: 4 · conforto 1 · conforto+premium 2 · essencial 1 · inválido 4 (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const base = `/buscar?local=${encodeURIComponent(CIDADE)}`;
        const casos: [string, number][] = [["", 4], ["&niveis=conforto", 1], ["&niveis=conforto,premium", 2], ["&niveis=essencial", 1], ["&niveis=xyz", 4]];
        for (const [q, esperado] of casos) {
          expect(await totalDaFolha(page, `${base}${q}`), `total com "${q || "sem filtro"}"`).toBe(esperado);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
