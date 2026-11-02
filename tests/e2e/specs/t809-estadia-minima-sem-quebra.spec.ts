import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T809 — resíduo "Estadia mínima" (02/11, Pista A): no cartão de Meus anúncios (anúncio Premium com estadia mínima de 90
  dias), a linha "Estadia mínima (3 meses): R$ … · 3 × R$ … + … R$ …" não quebra no meio de um termo — o valor nunca fica
  sozinho na linha de baixo. 360, 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t809.${sufixo}@lab.vivanomads.test`, nome: "Paula Premium", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T809 — estadia mínima sem termo quebrado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Loft premium t809 ${sufixo}`, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ min_period_days: 90 }).eq("id", ids.imovel);
    await adm().from("imovel_nivel").upsert({ property_id: ids.imovel, nivel: "premium" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [360, 390, 1280] as const) {
    test(`a ${w} px: a linha da estadia mínima quebra só entre os termos`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = p.locator(`[data-testid="meu-anuncio"][data-imovel="${ids.imovel}"]`);
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      const linha = cartao.getByTestId("preco-estadia");
      await expect(linha).toContainText(/^Estadia mínima \(3 meses\): R\$/);
      const quebrados = await linha.evaluate((el) => [...el.querySelectorAll(".whitespace-nowrap")].filter((s) => s.getClientRects().length > 1).length);
      expect(quebrados).toBe(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await cartao.screenshot({ path: `${SAIDA}/t809-cartao-${w}.png` });
      await p.context().close();
    });
  }
});
