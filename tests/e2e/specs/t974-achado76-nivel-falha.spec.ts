import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/**
 * T974 — #2125 (varredura de erros, rodada 13, achado 76): a leitura que falha nunca rebaixa o nível do anúncio. No
 * cadastro, o bloco do nível (Passo 5) aparecia vazio na falha — nível mais baixo e ruído em branco. Agora: "Não foi
 * possível ler o nível do anúncio agora. Nada foi alterado." com "Tentar de novo". Pela tela real
 * (/dashboard/imoveis/novo?draft=…&etapa=comodidades), 390 e 1280:
 *   1. só a ação que lê a entrada do nível responde 500 (as outras passam): o aviso (nivel-cadastro-falha, role=alert)
 *      no lugar do bloco — nenhum "Agora: …" calculado sem os dados;
 *   2. "Tentar de novo" com o servidor de volta: o bloco do nível volta (nivel-cadastro com "Agora: …"), sem o aviso.
 * Os achados 74 e 75 (servidor: nível gravado e aviso de queda) ficam com o teste de unidade do #2125.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t974.${sufixo}@lab.vivanomads.test`, nome: "Nilo Nível", role: "owner" as const };
const ids: Record<string, string> = {};
// Só a resposta de entradaNivelDoCadastro traz as provas com a chave "bloqueadas".
const MARCA = '"bloqueadas"';

async function nivelFalha(page: Page, liga: boolean) {
  const padrao = "**/dashboard/imoveis/novo**";
  if (!liga) return page.unrouteAll({ behavior: "wait" });
  await page.route(padrao, async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes(MARCA)) return await r.fulfill({ status: 500, body: "falha simulada (t974)" });
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T974 — #2125 achado 76: o bloco do nível avisa a falha de leitura, sem rebaixar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [390, 1280]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Nível t974 ${w} ${sufixo}`);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`falha → aviso no lugar do bloco; 'Tentar de novo' → o nível (${w})`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await nivelFalha(page, true);
      await page.goto(`/dashboard/imoveis/novo?draft=${ids[`r${w}`]}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      const falha = page.getByTestId("nivel-cadastro-falha");
      await falha.scrollIntoViewIfNeeded({ timeout: 30_000 });
      await expect(falha).toBeVisible();
      await expect(falha).toContainText("Não foi possível ler o nível do anúncio agora. Nada foi alterado.");
      await expect(falha).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("nivel-cadastro-agora")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await nivelFalha(page, false);
      await page.getByTestId("nivel-cadastro-tentar").click();
      await expect(page.getByTestId("nivel-cadastro-agora")).toContainText("Agora:", { timeout: 30_000 });
      await expect(page.getByTestId("nivel-cadastro-falha")).toHaveCount(0);
      await page.context().close();
    });
  }
});
