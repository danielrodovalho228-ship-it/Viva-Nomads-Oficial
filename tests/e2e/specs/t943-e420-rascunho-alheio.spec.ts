import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T943 — E420 (#2047): `/dashboard/imoveis/novo?draft=<id>` com rascunho que não existe ou é de OUTRA conta abria o
 * Passo 1 como cadastro novo em silêncio (e o 1º salvamento criava outro rascunho). Agora avisa, com uma mensagem só
 * para "não existe" e "é de outra conta" (não revela o anúncio dos outros). Pela tela real, 390 e 1280:
 *   1. rascunho de OUTRO dono: "Rascunho não encontrado" (data-motivo=nao_encontrado), com "Ver meus imóveis" e
 *      "Começar um anúncio novo"; nada nasce na conta de quem abriu e o rascunho do outro fica intacto;
 *   2. UUID que não existe e id que nem é UUID: a MESMA mensagem (indistinguível do caso 1);
 *   3. a leitura falha (ação do servidor em 500): "Não deu para abrir o rascunho" (data-motivo=indisponivel);
 *   4. o próprio rascunho abre o assistente normalmente (sem o aviso);
 *   5. "Começar um anúncio novo" leva ao assistente sem ?draft= e sem o aviso.
 * L-88 (achado aqui: o aviso não aparecia, página em branco) foi corrigido no #2061 — todos os casos são teste normal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t943.${sufixo}@lab.vivanomads.test`, nome: "Dalva Rascunho", role: "owner" as const };
const outro = { email: `outro.t943.${sufixo}@lab.vivanomads.test`, nome: "Osmar Visitante", role: "owner" as const };
const ids: { dona?: string; outro?: string; rascunhoDona?: string; rascunhoOutro?: string } = {};
const LARGURAS = [390, 1280] as const;
const INEXISTENTE = "00000000-0000-4000-8000-000000000943";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function imoveisDe(dono: string): Promise<number> {
  const { count } = await adm().from("properties").select("id", { count: "exact", head: true }).eq("owner_id", dono);
  return count ?? 0;
}

test.describe("T943 — E420: rascunho desconhecido ou de outra conta avisa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.outro = await criarConta(outro, senha);
    ids.rascunhoDona = await criarImovelPronto(ids.dona, `Rascunho da Dalva t943 ${sufixo}`, { semInternet: true, semConforto: true });
    ids.rascunhoOutro = await criarImovelPronto(ids.outro, `Rascunho do Osmar t943 ${sufixo}`, { semInternet: true, semConforto: true });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dona, ids.outro]);
  });

  test("abrir o rascunho de outra conta não cria nada nem muda o do outro", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dona.email, senha);
    const antes = await imoveisDe(ids.dona!);
    const { data: alheioAntes } = await adm().from("properties").select("title, status, draft_data").eq("id", ids.rascunhoOutro!).single();
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunhoOutro}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(await page.content(), "o título do rascunho do outro não vaza").not.toContain(`Rascunho do Osmar t943 ${sufixo}`);
    }
    await page.waitForTimeout(3_000);
    expect(await imoveisDe(ids.dona!), "nenhum rascunho novo na conta da Dalva").toBe(antes);
    const { data: alheioDepois } = await adm().from("properties").select("title, status, draft_data").eq("id", ids.rascunhoOutro!).single();
    expect(alheioDepois).toEqual(alheioAntes);
    await page.context().close();
  });

  test("rascunho alheio, inexistente e malformado: o mesmo aviso; a falha tem o próprio aviso", async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await entrar(browser, dona.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const [caso, id] of [["de outra conta", ids.rascunhoOutro!], ["inexistente", INEXISTENTE], ["malformado", "nao-e-uuid"]] as const) {
        await page.goto(`/dashboard/imoveis/novo?draft=${id}`, { waitUntil: "domcontentloaded" });
        const aviso = page.getByTestId("rascunho-fechado");
        await expect(aviso, `${caso} @${largura}`).toBeVisible({ timeout: 30_000 });
        await expect(aviso).toHaveAttribute("data-motivo", "nao_encontrado");
        await expect(aviso).toContainText("Rascunho não encontrado");
        await expect(aviso).toContainText("Este rascunho não existe ou não é desta conta. Confira se entrou com a conta certa.");
        await expect(aviso).not.toContainText(`Rascunho do Osmar t943 ${sufixo}`);
        await expect(page.getByTestId("rascunho-fechado-meus")).toHaveAttribute("href", "/dashboard/imoveis");
        await expect(page.getByTestId("rascunho-fechado-novo")).toHaveAttribute("href", "/dashboard/imoveis/novo");
        await semRolagemLateral(page);
      }
    }
    // 3. A leitura falha: o aviso de indisponível (não o de "não encontrado").
    await page.route("**/dashboard/imoveis/novo**", (r) =>
      r.request().method() === "POST" && r.request().headers()["next-action"] ? r.fulfill({ status: 500, body: "falha simulada (t943)" }) : r.continue(),
    );
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunhoDona}`, { waitUntil: "domcontentloaded" });
    const aviso = page.getByTestId("rascunho-fechado");
    await expect(aviso).toHaveAttribute("data-motivo", "indisponivel", { timeout: 30_000 });
    await expect(aviso).toContainText("Não deu para abrir o rascunho");
    await page.unroute("**/dashboard/imoveis/novo**");
    await page.context().close();
  });

  test("o próprio rascunho abre o assistente, sem o aviso (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dona.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunhoDona}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("rascunho-fechado")).toHaveCount(0);
      await semRolagemLateral(page);
    }
    await page.context().close();
  });

  test("'Começar um anúncio novo' do aviso abre o assistente sem ?draft= e sem o aviso (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dona.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${INEXISTENTE}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("rascunho-fechado")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("rascunho-fechado-novo").click();
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo$/, { timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("rascunho-fechado")).toHaveCount(0);
      await semRolagemLateral(page);
    }
    await page.context().close();
  });
});
