import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1175 — E503 (#2675, 05/11): o Início do painel (1) fecha com um rodapé curto — Central de ajuda, Termos de uso,
 * Privacidade —, em vez de acabar num vão em branco; (2) enquanto os recomendados carregam, a seção guarda o lugar com o
 * esqueleto dos cartões (inicio-recomendados-carregando), em vez de a página nascer curta. O E503 entrou só com teste de
 * unidade; aqui é a tela, 390 e 1280, com uma moradora nova e a leitura de /api/properties segurada por alguns segundos:
 *   1. com a leitura segurada, o esqueleto dos recomendados aparece; liberada, ele sai;
 *   2. o rodapé inicio-rodape está na página, com os três links (/ajuda, /termos, /privacidade);
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `inq.t1175.${sufixo}@lab.vivanomads.test`, nome: "Vera Inicio", role: "tenant" as const };
const ids: { morador?: string } = {};

test.describe("T1175 — E503: o Início guarda o lugar dos recomendados e fecha com o rodapé curto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`esqueleto enquanto os recomendados carregam; rodapé com ajuda e termos (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), morador.email, senha);
        let liberar: () => void = () => {};
        const segura = new Promise<void>((r) => (liberar = r));
        await p.route("**/api/properties*", async (rota) => {
          await segura;
          await rota.continue();
        });
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("inicio-recomendados-carregando")).toBeVisible({ timeout: 30_000 });
        liberar();
        await expect(p.getByTestId("inicio-recomendados-carregando")).toHaveCount(0, { timeout: 30_000 });

        const rodape = p.getByTestId("inicio-rodape");
        await rodape.scrollIntoViewIfNeeded();
        await expect(rodape).toBeVisible();
        for (const [href, rotulo] of [["/ajuda", "Central de ajuda"], ["/termos", "Termos de uso"], ["/privacidade", "Privacidade"]] as const) {
          await expect(rodape.getByRole("link", { name: rotulo })).toHaveAttribute("href", href);
        }
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
