import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T869 — Matriz, passada 10 (05/11): em /dashboard/carteira os indicadores dividem a linha com a mesma altura (regra da
  casa: cartões uniformes). Antes, a 390 px, "Reservados" (com dica) ficava mais alto que "Vagos" (sem dica). 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t869.${sufixo}@lab.vivanomads.test`, nome: "Dina Carteira", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T869 — indicadores da carteira com a mesma altura na linha", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });
  for (const w of [390, 1280] as const) {
    test(`a ${w} px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/carteira", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("carteira-ind-vagos")).toBeVisible({ timeout: 20_000 });
      const caixas = await p.locator('[data-testid^="carteira-ind-"]').evaluateAll((es) =>
        es.map((e) => {
          const c = (e.firstElementChild as HTMLElement).getBoundingClientRect();
          return { top: Math.round(c.top), h: Math.round(c.height) };
        }),
      );
      expect(caixas.length).toBe(6);
      const linhas = new Map<number, number[]>();
      for (const c of caixas) linhas.set(c.top, [...(linhas.get(c.top) ?? []), c.h]);
      for (const [top, alturas] of linhas) expect(Math.max(...alturas) - Math.min(...alturas), `linha em ${top}px: ${alturas}`).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t869-carteira-${w}.png` });
      await ctx.close();
    });
  }
});
