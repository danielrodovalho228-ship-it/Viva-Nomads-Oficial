import { test, expect, devices } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T915 — E136 (resíduo, Pista A): no cadastro, Passo 9, a 390 px no TOQUE o campo de data abria o seletor NATIVO do
  aparelho (no idioma dele). Agora tocar em "Disponível a partir de" e em "Disponível até" abre o calendário do site
  (o mesmo do computador), sem teclado; escolher um dia preenche dd/mm/aaaa. A 1280 px nada muda (botão do calendário).
  iPhone 13 com o navegador em inglês (en-US) e 1280 px. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t915.${sufixo}@lab.vivanomads.test`, nome: "Tina Toque", role: "owner" as const };
const ids: { dono?: string; r390?: string; r1280?: string } = {};

test.describe("T915 — E136: no toque, o campo de data do cadastro abre o calendário do site", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.r390 = await prepararRascunho(ids.dono, `Studio t915 a ${sufixo}`);
    ids.r1280 = await prepararRascunho(ids.dono, `Studio t915 b ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("390 px (toque): tocar no campo abre o calendário do site, sem seletor nativo, e o dia escolhido entra em dd/mm/aaaa", async ({ browser }) => {
    const { defaultBrowserType: _t, ...iphone } = devices["iPhone 13"];
    void _t;
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.r390!, "disponibilidade", 390, { ...iphone, locale: "en-US" });
    expect(await page.locator('[data-testid="etapa-disponibilidade"] input[type="date"]').count(), "nenhum seletor nativo").toBe(0);
    for (const [campo, dias] of [["disponivel-de", 5], ["disponivel-ate", 50]] as const) {
      const iso = emDiasBR(dias);
      const el = page.getByTestId(campo);
      await expect(el).toHaveAttribute("inputmode", "none", { timeout: 30_000 });
      await el.tap();
      const pop = page.getByTestId(`${campo}-calendario-popup`);
      await expect(pop, "o toque abre o calendário do site").toBeVisible();
      const caixa = await pop.boundingBox();
      expect(caixa && caixa.x >= 0 && caixa.x + caixa.width <= 391, "o calendário cabe na tela").toBeTruthy();
      // Anda até o mês do dia (o dia 50 pode cair dois meses à frente).
      for (let i = 0; i < 3 && (await pop.locator(`[data-dia="${iso}"]`).count()) === 0; i++) await pop.getByRole("button", { name: /próximo mês/i }).tap();
      await pop.locator(`[data-dia="${iso}"]`).tap();
      await expect(pop).toHaveCount(0);
      await expect(el).toHaveValue(isoParaBR(iso));
    }
    const lateral = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(lateral, "rolagem lateral").toBeLessThanOrEqual(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t915-toque-390.png" });
    await page.context().close();
  });

  test("1280 px: o campo segue de texto (digitar) e o calendário abre no botão", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.r1280!, "disponibilidade", 1280, { locale: "en-US" });
    const el = page.getByTestId("disponivel-de");
    await expect(el).toHaveAttribute("inputmode", "numeric", { timeout: 30_000 });
    await page.getByTestId("disponivel-de-calendario").click();
    await expect(page.getByTestId("disponivel-de-calendario-popup")).toBeVisible();
    await page.context().close();
  });
});
