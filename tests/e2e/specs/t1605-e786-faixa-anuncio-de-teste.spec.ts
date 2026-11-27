import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1605 — E786 (julgamento de 11/11): faixa do anúncio de teste conforme a especificação, igual em TODOS os anúncios de
  teste, sem estouro horizontal:
   • anúncio de CONTA DE TESTE sem a marca no título (como o VN-4A693A, "TESTE QA - Casa…") também mostra a faixa;
   • o texto é "Anúncio de teste da equipe Viva — não é um imóvel disponível" para o visitante E para a equipe (o dono);
   • a 390 e a 1280 px, a faixa quebra linha e a página não rola na horizontal.
*/
const FAIXA = "Anúncio de teste da equipe Viva — não é um imóvel disponível";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1605.${sufixo}@lab.vivanomads.test`, nome: "Tereza Teste Faixa", role: "owner" as const };
const ids: Record<string, string | undefined> = {};

test.describe("T1605 — E786 faixa do anúncio de teste", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    // Sem colchetes: a marca do título NÃO pega; o que faz dele anúncio de teste é o dono ser conta de teste (E131).
    ids.imovel = await criarImovelPronto(ids.dono, `TESTE QA - Casa mobiliada ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — visitante: a faixa especificada aparece, quebra linha e não estoura`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const faixa = page.getByTestId("faixa-anuncio-teste");
      await expect(faixa).toHaveText(FAIXA, { timeout: 20_000 });
      await expect(faixa).toHaveAttribute("data-modo", "visitante");
      const caixa = await faixa.boundingBox();
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(largura);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t1605-visitante-${largura}.png` });
    });
  }

  test("390px — equipe (o dono): o MESMO texto e o mesmo desenho da faixa", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const faixa = page.getByTestId("faixa-anuncio-teste");
    await expect(faixa).toHaveAttribute("data-modo", "equipe", { timeout: 20_000 });
    await expect(faixa).toHaveText(FAIXA);
    await expect(faixa).toHaveClass(/bg-amber-50/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.context().close();
  });
});
