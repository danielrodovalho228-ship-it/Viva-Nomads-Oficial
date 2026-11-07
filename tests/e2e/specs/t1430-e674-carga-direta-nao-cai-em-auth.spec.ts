import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1430 — E674 (resíduo, #3263): uma carga direta de uma tela do painel, com a sessão viva, não cai em /auth por uma leitura
  transitória de "sem sessão". Conta logada abre /dashboard/contratos (e /dashboard/locacoes) em abas novas do mesmo navegador,
  em paralelo (o caso de renovação do token em curso/duas abas): nenhuma vai para /auth e a tela do painel aparece.
  Guarda de regressão do comportamento (a transitória em si não é reproduzível de forma determinística no lab). 390 e 1280 px.
*/
const senha = novaSenha();
const inq = { email: `inq.t1430.${novoSufixo()}@lab.vivanomads.test`, nome: "Ivo Carga Direta", role: "tenant" as const };
const ids: { inq?: string } = {};
const ROTAS = ["/dashboard/contratos", "/dashboard/locacoes", "/dashboard/contratos"];

test.describe("T1430 — E674 resíduo: carga direta com sessão viva não vai para /auth", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inq]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: três cargas diretas em paralelo ficam no painel`, async ({ browser }) => {
      const base = await entrar(browser, inq.email, senha);
      const ctx = base.context();
      const abas = await Promise.all(ROTAS.map(async () => ctx.newPage()));
      await Promise.all(abas.map((p) => p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 })));
      await Promise.all(abas.map((p, i) => p.goto(ROTAS[i], { waitUntil: "domcontentloaded" })));
      for (const [i, p] of abas.entries()) {
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(p.locator("main").first()).toBeVisible({ timeout: 30_000 });
        expect(new URL(p.url()).pathname, `aba ${i + 1} (${ROTAS[i]}) não vai para /auth`).not.toMatch(/^\/auth/);
        expect(new URL(p.url()).pathname).toBe(ROTAS[i]);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
      await ctx.close();
    });
  }
});
