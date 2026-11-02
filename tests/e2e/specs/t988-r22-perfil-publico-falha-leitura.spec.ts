import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T988 — #2174, varredura de erros rodada 22 (lote 2), achado 110: em Conta › Seu perfil público, a falha na leitura
 * do perfil do morador não vira um perfil "Você" vazio (nome genérico, sem cidade, "Não informado"): meuPerfilPublico()
 * lança e a tela avisa "Não foi possível ler seu perfil agora. Recarregue a página." 390 e 1280:
 *   1. controle: sem falha, o cartão seu-perfil-publico mostra o nome curto da conta (a massa é real);
 *   2. com a resposta de meuPerfilPublico() trocada por 500 (só ela: a resposta com "ehDono"), a página abre, o aviso
 *      aparece e o cartão não — nada de "Você" no lugar do nome.
 * Os outros achados das rodadas 22 (102–109, 111, 112; #2173 e #2174) são leituras dentro do servidor (renderização
 * ou o meio de uma ação): o navegador não simula essa falha; ficam com os testes de unidade.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `perf.t988.${sufixo}@lab.vivanomads.test`, nome: "Renata Perfilada Sobrenome", role: "tenant" as const };
const ids: { conta?: string } = {};
const AVISO = "Não foi possível ler seu perfil agora. Recarregue a página.";

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const page = await entrar(browser, conta.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

/** Troca por 500 só a resposta da ação do servidor com o perfil público; as outras passam. */
async function falharLeitura(page: Page, vistas: string[]) {
  await page.route("**/dashboard/conta/perfil-publico**", async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes('"ehDono"')) {
        vistas.push("falhou");
        return await r.fulfill({ status: 500, body: "falha simulada (t988)" });
      }
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T988 — #2174 achado 110: falha na leitura do perfil público não mostra um perfil vazio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle: o cartão mostra o nome da conta (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      await page.goto("/dashboard/conta/perfil-publico", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("seu-perfil-publico");
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(cartao.getByTestId("perfil-publico-nome")).toContainText("Renata");
      await expect(page.getByText(AVISO)).toHaveCount(0);
      await page.context().close();
    });

    test(`leitura que falha: o aviso no lugar do perfil vazio (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      const vistas: string[] = [];
      await falharLeitura(page, vistas);
      await page.goto("/dashboard/conta/perfil-publico", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Seu perfil público" })).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => vistas.length, { timeout: 30_000, message: "a leitura do perfil precisa ter sido interceptada" }).toBeGreaterThan(0);
      await expect(page.getByText(AVISO)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("seu-perfil-publico")).toHaveCount(0);
      await expect(page.getByTestId("perfil-publico-nome")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.unrouteAll({ behavior: "wait" });
      await page.context().close();
    });
  }
});
