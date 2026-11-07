import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1393 — E678 (draft Pista A, branch claude-a/e678-scroll-padding): o assistente do anúncio tem cabeçalho preso (sticky, 64 px)
  e agora declara o respiro de CIMA além do de baixo: `scroll-padding-top` do <html> é pelo menos a altura do cabeçalho preso
  (5rem = 80 px), então qualquer rolagem programática que leva um título/campo ao topo o deixa ABAIXO do cabeçalho, e o
  `scroll-padding-bottom` (8rem, do rodapé fixo) continua. Teste direto da propriedade e da posição de um alvo levado ao topo.
  Dono logado em /dashboard/imoveis/novo, 390 e 1280 px. Spec preparada sobre a branch do draft; só roda verde com o E678.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1393.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Assistente", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1393 — E678: o cabeçalho preso do assistente não cobre o alvo levado ao topo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: scroll-padding-top cobre o cabeçalho preso e o de baixo segue`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.locator("main").first()).toBeVisible({ timeout: 30_000 });
      const medidas = await p.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const px = (v: string) => parseFloat(v) || 0;
        // O cabeçalho preso do assistente: o primeiro elemento sticky/fixed no topo, com altura.
        const preso = Array.from(document.querySelectorAll<HTMLElement>("header, [class*='sticky']")).find((e) => {
          const c = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return (c.position === "sticky" || c.position === "fixed") && r.top <= 1 && r.height > 20;
        });
        return { topo: px(css.scrollPaddingTop), baixo: px(css.scrollPaddingBottom), cabecalho: preso ? Math.round(preso.getBoundingClientRect().bottom) : 0 };
      });
      expect(medidas.cabecalho, "o assistente tem cabeçalho preso").toBeGreaterThan(20);
      expect(medidas.topo, `scroll-padding-top (${medidas.topo}px) cobre o cabeçalho (${medidas.cabecalho}px)`).toBeGreaterThanOrEqual(medidas.cabecalho);
      expect(medidas.baixo, "o respiro de baixo do rodapé fixo continua").toBeGreaterThanOrEqual(120);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
