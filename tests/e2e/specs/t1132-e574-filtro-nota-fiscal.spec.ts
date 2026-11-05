import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1132 — E574 (#2540, 05/11): o filtro "Emite nota fiscal" da busca de imóveis (`?nota=1`) vale pela DECLARAÇÃO do
 * dono PJ (MEI conta como PJ) — profiles.emite_nota_locacao (0294). Dono PF nunca entra (a plataforma gera o recibo);
 * PJ que respondeu "não" ou não respondeu também não. Entrou com o e574-nota-locacao.test.ts; aqui é a busca real,
 * numa cidade só do teste, com 3 anúncios ativos de 3 donos, 390 e 1280 (o total lido no "Aplicar", como a t350):
 *   PJ que declarou emitir · PJ que declarou não emitir · PF  →  sem filtro 3 · `?nota=1` 1.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Nota Fiscal ${sufixo}`;
const donos = {
  pjSim: { email: `pjsim.t1132.${sufixo}@lab.vivanomads.test`, nome: "Empresa Sim Nota", role: "owner" as const },
  pjNao: { email: `pjnao.t1132.${sufixo}@lab.vivanomads.test`, nome: "Empresa Nao Nota", role: "owner" as const },
  pf: { email: `pf.t1132.${sufixo}@lab.vivanomads.test`, nome: "Pessoa Fisica Nota", role: "owner" as const },
};
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

test.describe("T1132 — E574: o filtro \"Emite nota fiscal\" segue a declaração do dono PJ", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    for (const [k, d] of Object.entries(donos)) {
      ids[k] = await criarConta(d, senha);
      ids[`im_${k}`] = await criarImovelPronto(ids[k], `Studio nota ${k} ${sufixo}`, { ativo: true });
    }
    const { error: eCidade } = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.im_pjSim, ids.im_pjNao, ids.im_pf]);
    expect(eCidade, eCidade?.message).toBeNull();
    const { error: eSim } = await adm().from("profiles").update({ person_type: "pj", emite_nota_locacao: true }).eq("id", ids.pjSim);
    expect(eSim, eSim?.message).toBeNull();
    const { error: eNao } = await adm().from("profiles").update({ person_type: "pj", emite_nota_locacao: false }).eq("id", ids.pjNao);
    expect(eNao, eNao?.message).toBeNull();
    const { error: ePf } = await adm().from("profiles").update({ person_type: "pf", emite_nota_locacao: null }).eq("id", ids.pf);
    expect(ePf, ePf?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.pjSim, ids.pjNao, ids.pf]);
  });

  for (const w of [390, 1280] as const) {
    test(`sem filtro 3; ?nota=1 só o anúncio do PJ que declarou emitir (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const base = `/buscar?local=${encodeURIComponent(CIDADE)}`;
        expect(await totalDaFolha(page, base), "os 3 anúncios da cidade do teste").toBe(3);
        expect(await totalDaFolha(page, `${base}&nota=1`), "só o PJ que declarou emitir nota").toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
