import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1081 — E495 (#2408, 04/11): "Recibos e notas" com uma porta só. Antes havia três caminhos para /dashboard/recibos
 * (o cartão em Ferramentas, o atalho "Informe para o IR" e o menu de Contratos); fica só Contratos › Recibos e notas.
 * Pela tela real, proprietário com um anúncio, 390 e 1280:
 *   1. Ferramentas: nenhum link para /dashboard/recibos (nem o cartão "Recibos e notas", nem "Informe para o IR");
 *   2. o grupo "Análise & cálculo" fica com 3 cartões e a grade par: em 1280 os dois primeiros lado a lado e o terceiro
 *      na linha inteira; em 390, uma coluna; sem estouro;
 *   3. a porta que fica: em Contratos, a subaba "Recibos e notas" leva a /dashboard/recibos.
 * As regras (sem /dashboard/recibos em Ferramentas, uma subaba, a classe da grade) ficam com o e495-recibos-uma-porta.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1081.${sufixo}@lab.vivanomads.test`, nome: "Rosa Recibos Pinto", role: "owner" as const };
const ids: Record<string, string> = {};
const sobra = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1081 — E495: Recibos e notas com uma porta só (Contratos)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos recibos t1081 ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`Ferramentas sem porta para os recibos; grade par em Análise & cálculo; Contratos › Recibos e notas (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      // 1. Ferramentas.
      await p.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
      const grupos = p.getByTestId("ferramentas-grupo");
      await expect(grupos.first()).toBeVisible({ timeout: 30_000 });
      const main = p.locator("main");
      await expect(main.locator('a[href^="/dashboard/recibos"]')).toHaveCount(0);
      await expect(main).not.toContainText("Recibos e notas");
      await expect(main).not.toContainText("Informe para o IR");
      await expect(p.getByTestId("atalho-informe-ir")).toHaveCount(0);

      // 2. "Análise & cálculo": 3 cartões, o último na linha inteira no computador.
      const analise = grupos.filter({ hasText: "Análise & cálculo" });
      const cartoes = analise.getByTestId("ferramenta-card");
      await expect(cartoes).toHaveCount(3);
      const larguras = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
      if (w === 1280) {
        expect(Math.abs(larguras[0] - larguras[1]), `lado a lado: ${larguras}`).toBeLessThanOrEqual(2);
        expect(larguras[2], `o 3º na linha inteira: ${larguras}`).toBeGreaterThan(larguras[0] * 1.8);
      } else {
        expect(Math.max(...larguras) - Math.min(...larguras), `uma coluna: ${larguras}`).toBeLessThanOrEqual(2);
      }
      expect(await sobra(p)).toBeLessThanOrEqual(1);

      // 3. A porta que fica: Contratos › Recibos e notas.
      await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      const sub = p.getByTestId("subaba-dono-recibos").filter({ visible: true }).first();
      await expect(sub).toHaveText("Recibos e notas", { timeout: 30_000 });
      await expect(sub).toHaveAttribute("href", "/dashboard/recibos");
      await sub.click();
      await expect(p).toHaveURL(/\/dashboard\/recibos$/, { timeout: 30_000 });
      await p.context().close();
    });
  }
});
