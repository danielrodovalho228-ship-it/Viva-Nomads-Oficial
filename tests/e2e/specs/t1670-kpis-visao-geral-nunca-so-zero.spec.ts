import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1670 — Ordem de8761b0, item 3 (resto do #644): na Visão geral do proprietário os quatro números dizem o período e,
  quando zero, a próxima ação — nunca só "0". Dono novo com 1 anúncio publicado, sem visitas, interessados nem conversas:
   1. "Visualizações · últimos 30 dias" = 0 com "Compartilhe seu anúncio para ser visto." (leva a Meus imóveis).
   2. "Interessados · últimos 30 dias" = 0 com "Compartilhe seu anúncio para receber candidaturas." (#644).
   3. "Mensagens" = 0 com "Quando um interessado escrever, responda rápido." (leva a Mensagens).
   4. 390 e 1280 px, sem rolagem lateral.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string | undefined> = {};
const dono = { email: `dono.t1670.${sufixo}@lab.vivanomads.test`, nome: "Dora Numeros Sobrenome", role: "owner" as const };

test.describe("T1670 — KPIs da Visão geral nunca só '0' (de8761b0 item 3)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio números ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: período e próxima ação em cada número zerado`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor();

      // O cartão é o avô do rótulo (rótulo → linha do rótulo → cartão), o mesmo StatCard de primitives.tsx.
      const cartao = (rotulo: string) =>
        page.getByTestId("stat-rotulo").filter({ hasText: new RegExp(`^\\s*${rotulo}\\s*$`) }).first().locator("xpath=../..");

      const visu = cartao("Visualizações · últimos 30 dias");
      await expect(visu.getByTestId("stat-valor")).toHaveText("0");
      await expect(visu.getByTestId("stat-hint")).toHaveText("Compartilhe seu anúncio para ser visto.");

      const inter = cartao("Interessados · últimos 30 dias");
      await expect(inter.getByTestId("stat-valor")).toHaveText("0");
      await expect(inter.getByTestId("stat-hint")).toHaveText("Compartilhe seu anúncio para receber candidaturas.");

      const msg = cartao("Mensagens");
      await expect(msg.getByTestId("stat-valor")).toHaveText("0");
      await expect(msg.getByTestId("stat-hint")).toHaveText("Quando um interessado escrever, responda rápido.");

      await expect(page.locator('a[href="/dashboard/mensagens"]').filter({ has: page.getByTestId("stat-rotulo") })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t1670-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }
});
