import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T802 — E416 (retrabalho, 01/11): em Meus anúncios, o cartão REAL do anúncio mostra o selo de nível. Causa raiz: a tela
  lê listMyProperties, que não buscava o nível (o #2064 pôs o nível em outra função), e o cartão nem desenhava o selo.
  Anúncio ativo com "conforto", rascunho com "premium" e anúncio sem nível (sem selo). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t802.${sufixo}@lab.vivanomads.test`, nome: "Nara Nivel", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T802 — E416: selo de nível em Meus anúncios", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.ativo = await criarImovelPronto(ids.dono, `Studio conforto t802 ${sufixo}`, { ativo: true, preco: 2700 });
    ids.rascunho = await criarImovelPronto(ids.dono, `Loft premium t802 ${sufixo}`, { semInternet: true, semConforto: true });
    ids.sem = await criarImovelPronto(ids.dono, `Casa sem nivel t802 ${sufixo}`, { semInternet: true, semConforto: true });
    for (const [id, nivel] of [[ids.ativo, "conforto"], [ids.rascunho, "premium"]] as const) {
      const { error } = await adm().from("imovel_nivel").upsert({ property_id: id, nivel });
      if (error) throw error;
    }
    await adm().from("imovel_nivel").delete().eq("property_id", ids.sem);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: selo de nível nos cartões reais de Meus anúncios`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(cartao(ids.ativo)).toBeVisible({ timeout: 30_000 });
      await expect(cartao(ids.ativo).getByTestId("anuncio-nivel")).toHaveText("Conforto");
      await expect(cartao(ids.rascunho).getByTestId("anuncio-nivel")).toHaveText("Premium");
      await expect(cartao(ids.sem).getByTestId("anuncio-nivel")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await cartao(ids.ativo).scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t802-meus-anuncios-${w}.png` });
      await p.context().close();
    });
  }
});
