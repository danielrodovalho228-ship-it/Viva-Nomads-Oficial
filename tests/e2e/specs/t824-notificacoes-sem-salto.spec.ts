import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T824 — estabilidade (02/11, Pista A): Conta › Notificações não "pula" ao carregar as preferências (antes: 0,13 no
  celular, os blocos de espera eram mais baixos que os cartões). Exige layout shift < 0,1 e os interruptores reais no
  fim. 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `notif.t824.${sufixo}@lab.vivanomads.test`, nome: "Nina Notif", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T824 — Notificações sem salto de layout", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.pessoa]);
  });
  for (const w of [390, 1280] as const) {
    test(`a ${w} px: layout shift < 0,1`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      await ctx.addInitScript(() => {
        const g = window as unknown as { __cls: number };
        g.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) g.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.evaluate(() => { (window as unknown as { __cls: number }).__cls = 0; });
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-notificacoes").waitFor({ timeout: 20_000 });
      await expect(p.getByTestId("notif-trilho-carregando")).toHaveCount(0);
      await p.waitForTimeout(1500);
      expect(await p.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
      await ctx.close();
    });
  }
});
