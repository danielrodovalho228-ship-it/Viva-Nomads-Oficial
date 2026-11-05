import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1146 — E523 (#2586, 05/11): na busca, o filtro Local "até N min" vale também quando não há tempo de rota (só a linha
 * reta). Antes, "até 15 min a pé" mantinha imóveis a ~4 km. Agora sai quem, nem na velocidade máxima do modo (a pé
 * 6 km/h → 1,5 km em 15 min), chegaria no tempo. O /api/tempos responde "só linha reta" (reta: true, sem itens) para
 * forçar o caminho novo. Cidade só do teste, um anúncio no destino e outro a ~5 km, 390 e 1280:
 *   1. com o destino e sem limite de tempo, os dois aparecem;
 *   2. com "até 15 min a pé", o perto fica e o de ~5 km sai;
 *   3. sem estouro horizontal.
 * (O ponto público do anúncio é o aproximado da 0066, a até ~500 m do real: as distâncias têm folga para isso.)
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Retópolis ${sufixo}`;
const DESTINO = { lat: -18.919, lng: -48.277 };
const dono = { email: `dono.t1146.${sufixo}@lab.vivanomads.test`, nome: "Lia Local", role: "owner" as const };
const ids: { dono?: string; perto?: string; longe?: string } = {};
const TITULO = { perto: `Studio perto ${sufixo}`, longe: `Studio longe ${sufixo}` };
const base = `/buscar?local=${encodeURIComponent(CIDADE)}&dlat=${DESTINO.lat.toFixed(3)}&dlng=${DESTINO.lng.toFixed(3)}&drot=${encodeURIComponent("Trabalho do teste")}&modo=a_pe`;

async function abrirBusca(page: Page, url: string) {
  // A busca fica em cache por até 60 s: recarrega até o anúncio perto (que fica nos dois casos) aparecer.
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("cartao-imovel").filter({ hasText: TITULO.perto })).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

test.describe("T1146 — E523: 'até N min' vale pela linha reta quando não há tempo de rota", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.perto = await criarImovelPronto(ids.dono, TITULO.perto, { ativo: true });
    ids.longe = await criarImovelPronto(ids.dono, TITULO.longe, { ativo: true });
    // O trigger da 0066 guarda o ponto real nas colunas exatas e publica o aproximado.
    const { error: eP } = await adm().from("properties").update({ city: CIDADE, lat: DESTINO.lat, lng: DESTINO.lng }).eq("id", ids.perto);
    expect(eP, eP?.message).toBeNull();
    const { error: eL } = await adm().from("properties").update({ city: CIDADE, lat: DESTINO.lat - 0.046, lng: DESTINO.lng }).eq("id", ids.longe);
    expect(eL, eL?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`sem limite os dois; até 15 min a pé, sai o de ~5 km (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.route("**/api/tempos", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ itens: [], reta: true }) }));
        const perto = page.getByTestId("cartao-imovel").filter({ hasText: TITULO.perto });
        const longe = page.getByTestId("cartao-imovel").filter({ hasText: TITULO.longe });

        await abrirBusca(page, base);
        await expect(longe, "sem limite de tempo, o de ~5 km também aparece").toBeVisible({ timeout: 15_000 });

        await abrirBusca(page, `${base}&ate=15`);
        await expect(perto).toBeVisible();
        await expect(longe, "a ~5 km, nem a 6 km/h chega em 15 min").toHaveCount(0, { timeout: 15_000 });

        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
