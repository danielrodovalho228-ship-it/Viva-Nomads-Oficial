import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { cliqueResponde } from "../fixtures/varredura";

/*
  T1610 — E796 (t406, t407, t408, t551: regressões da rodada fatiada de 12/11). Depois do E786 (#3743), o anúncio de
  dono-conta-de-teste é anúncio de teste e o primário do visitante ("Pedir para morar") fica DESATIVADO (E93) — certo —,
  mas sem dizer por quê: a varredura (critério f) reprova trava silenciosa. O botão desativado aponta para a faixa que
  explica (aria-describedby → a faixa "Anúncio de teste da equipe Viva — não é um imóvel disponível"), a 1280 (cartão
  lateral) e a 390 (rodapé fixo).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1610.${sufixo}@lab.vivanomads.test`, nome: "Tito Trava", role: "owner" as const };
const ids: Record<string, string | undefined> = {};

test.describe("T1610 — E796: o primário desativado do anúncio de teste explica o motivo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da varredura ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`${largura}px — visitante: o primário desativado aponta para a faixa e a varredura não acha trava silenciosa`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("faixa-anuncio-teste")).toBeVisible({ timeout: 20_000 });
      const primario = page.locator('main [data-cta="primary"]:visible').first();
      await expect(primario).toBeDisabled({ timeout: 20_000 });
      const alvo = await primario.getAttribute("aria-describedby");
      expect(alvo, "o botão desativado diz por quê (aria-describedby)").toBeTruthy();
      await expect(page.locator(`[id="${alvo}"]`)).toHaveText("Anúncio de teste da equipe Viva — não é um imóvel disponível");
      expect(await cliqueResponde(page, page.locator('main [data-cta="primary"]:visible'), "primário")).toEqual([]);
    });
  }
});
