import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1122 — E567 (#2526, 04/11): um percentual por anúncio em todas as telas, e anúncio ATIVO sem "% completo". Entrou com
 * o e567-percentual-unico.test.ts (que lê o código-fonte); aqui é a tela real, 390 e 1280, com um dono que tem um
 * anúncio publicado e um rascunho ainda incompleto (sem a velocidade da internet):
 *   1. Meus imóveis: o cartão do PUBLICADO não tem a prontidão ("Anúncio N% completo"); o do rascunho tem;
 *   2. editor do publicado: diz "Anúncio publicado", sem "% completo" e sem a barra (prontidao-barra);
 *   3. Início: o bloco do rascunho traz o NOME do rascunho (inicio-dono-nome) junto do "N% pronto" — o mesmo N de Meus
 *      imóveis (o percentual é deste anúncio em andamento, não do publicado).
 * O assistente (que reabre o rascunho) fica de fora: o número dele é o L-94, na t1085 (#2438).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1122.${sufixo}@lab.vivanomads.test`, nome: "Nina Percentual Rocha", role: "owner" as const };
const T = { ativo: `Casa publicada E567 ${sufixo}`, rascunho: `Loft em andamento E567 ${sufixo}` };
const ids: Record<string, string> = {};

test.describe("T1122 — E567: um percentual por anúncio; publicado sem \"% completo\"", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativo = await criarImovelPronto(ids.dono, T.ativo, { ativo: true });
    ids.rascunho = await criarImovelPronto(ids.dono, T.rascunho, { semInternet: true });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`publicado sem percentual (lista e editor); rascunho com o mesmo N e o nome no Início (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        // 1. Meus imóveis.
        await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
        const cartaoAtivo = p.getByTestId("meu-anuncio").filter({ hasText: T.ativo });
        const cartaoRasc = p.getByTestId("meu-anuncio").filter({ hasText: T.rascunho });
        await expect(cartaoRasc.getByTestId("prontidao")).toBeVisible({ timeout: 30_000 });
        await expect(cartaoAtivo).toBeVisible();
        await expect(cartaoAtivo.getByTestId("prontidao")).toHaveCount(0);
        await expect(cartaoAtivo).not.toContainText("% completo");
        const m = (await cartaoRasc.getByTestId("prontidao").innerText()).match(/Anúncio (\d+)% completo/);
        expect(m, "o rascunho incompleto diz \"Anúncio N% completo\"").not.toBeNull();
        const n = Number(m![1]);
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThan(100);

        // 2. Editor do publicado.
        await p.goto(`/dashboard/imoveis/${ids.ativo}/editar`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 30_000 });
        await expect(p.getByTestId("prontidao-barra")).toHaveCount(0);
        await expect(p.locator("main")).not.toContainText("% completo");

        // 3. Início: o nome do rascunho junto do mesmo N.
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const bloco = p.locator('[data-testid="inicio-dono-principal"][data-tipo="rascunho"]');
        await expect(bloco).toBeVisible({ timeout: 30_000 });
        await expect(bloco.getByTestId("inicio-dono-nome")).toHaveText(T.rascunho);
        await expect(bloco.getByTestId("inicio-dono-pct")).toHaveAttribute("data-pct", String(n));
        await expect(bloco.getByTestId("inicio-dono-pct")).toContainText(`${n}% pronto`);

        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
