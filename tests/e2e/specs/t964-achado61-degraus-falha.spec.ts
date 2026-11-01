import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T964 — #2090 (varredura de erros, rodada 9, achado 61): meusDegraus engolia o erro e o bloco dos degraus do perfil
 * mostrava nome, foto e telefone como "pendentes" — a pessoa refazia. Agora lança e o bloco avisa, com "Tentar de
 * novo". Pela tela real (Conta › Meus dados), 390 e 1280:
 *   1. só a ação dos degraus responde 500 (as outras ações da tela passam): "Não foi possível carregar o estado do seu
 *      perfil agora." com "Tentar de novo" (role=alert) — e nenhum degrau como "pendente";
 *   2. "Tentar de novo" com o servidor de volta: o bloco dos degraus aparece (degraus-perfil), sem o aviso.
 * Os achados 62–65 (respostas rápidas da conversa, conferidos do admin, sugestões das fotos e filtro de cidade) ficam
 * com o teste de unidade do #2090 (achado61-65-leituras.test.ts) — as leituras são do servidor ou de telas do admin.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `degraus.t964.${sufixo}@lab.vivanomads.test`, nome: "Dalila Degraus", role: "tenant" as const };
const ids: { conta?: string } = {};
const ROTA = "**/dashboard/conta/dados**";
// Texto que só a resposta de meusDegraus traz (o degrau "E-mail", de src/lib/onboarding/degraus.ts).
const MARCA = "Para entrar e receber os avisos.";

async function degrausFalham(page: Page, liga: boolean) {
  if (!liga) return page.unrouteAll({ behavior: "wait" });
  await page.route(ROTA, async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes(MARCA)) return await r.fulfill({ status: 500, body: "falha simulada (t964)" });
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T964 — #2090 achado 61: os degraus do perfil avisam a falha de leitura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  test("falha → aviso, sem 'pendente'; 'Tentar de novo' → os degraus (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await degrausFalham(page, true);
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      const falha = page.getByTestId("degraus-perfil-falha");
      await falha.scrollIntoViewIfNeeded({ timeout: 30_000 });
      await expect(falha).toBeVisible();
      await expect(falha).toContainText("Não foi possível carregar o estado do seu perfil agora.");
      await expect(falha).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("degraus-perfil")).toHaveCount(0);
      await expect(page.getByTestId("degrau-estado")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await degrausFalham(page, false);
      await page.getByTestId("degraus-perfil-tentar").click();
      await expect(page.getByTestId("degraus-perfil")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("degraus-perfil-falha")).toHaveCount(0);
      await expect(page.getByTestId("degrau-estado").first()).toBeVisible();
    }
    await page.context().close();
  });
});
