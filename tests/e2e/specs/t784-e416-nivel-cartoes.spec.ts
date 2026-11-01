import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T784 — E416 (01/11): o cartão do anúncio mostra o nível (Essencial/Conforto/Premium) na linha-síntese. Na busca já
  vinha; na página pública do proprietário (/proprietario/[id]) o MESMO anúncio saía sem o nível. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t784.${sufixo}@lab.vivanomads.test`, nome: "Nina Nivel", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T784 — E416: nível no cartão do anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio nivel t784 ${sufixo}`, { ativo: true, preco: 2700 });
    const { error } = await adm().from("imovel_nivel").upsert({ property_id: ids.imovel, nivel: "conforto" });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: "Conforto" no cartão da página do proprietário e da busca`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("cartao-imovel").filter({ hasText: `Studio nivel t784 ${sufixo}` }).first();
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(cartao.getByTestId("card-nivel")).toHaveText("Conforto");
      await cartao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t784-proprietario-${w}.png` });
      await expect(async () => {
        await page.goto("/buscar", { waitUntil: "domcontentloaded" });
        const naBusca = page.getByTestId("cartao-imovel").filter({ hasText: `Studio nivel t784 ${sufixo}` }).first();
        await expect(naBusca.getByTestId("card-nivel")).toHaveText("Conforto", { timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
    });
  }
});
