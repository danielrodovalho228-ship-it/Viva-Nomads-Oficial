import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T968 — #2093 (varredura de erros, rodada 10, achado 66): em Conta › Meus dados, a falha de leitura abria o
 * formulário VAZIO e "Salvar" apagava o nome e o telefone gravados. Agora getMeusDados lança: a tela avisa e o salvar
 * recusa. Pela tela real (/dashboard/conta/dados), 390 e 1280, conta com nome e telefone gravados:
 *   1. a ação que lê os dados responde 500 (as outras passam): aparece "Não foi possível carregar seus dados agora.
 *      Recarregue a página antes de salvar.";
 *   2. "Salvar" com o formulário assim RECUSA — o aviso fica e o banco segue com o nome e o telefone de antes;
 *   3. recarregada com o servidor de volta: sem o aviso.
 * Os achados 67–69 (espaço de trabalho, por que na cidade, categoria) ficam com o teste de unidade do #2093
 * (achado66-69-formularios.test.ts).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = `Nadia Dados ${sufixo}`;
const conta = { email: `dados.t968.${sufixo}@lab.vivanomads.test`, nome: NOME, role: "tenant" as const };
const ids: { conta?: string } = {};
const ROTA = "**/dashboard/conta/dados**";
const AVISO = "Não foi possível carregar seus dados agora. Recarregue a página antes de salvar.";

/** Só a ação cuja resposta traz o nome gravado (getMeusDados) responde 500; as outras passam. */
async function dadosFalham(page: Page, liga: boolean) {
  if (!liga) return page.unrouteAll({ behavior: "wait" });
  await page.route(ROTA, async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes(NOME)) return await r.fulfill({ status: 500, body: "falha simulada (t968)" });
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}
async function gravado() {
  const { data } = await adm().from("profiles").select("full_name, phone").eq("id", ids.conta!).single();
  return data as { full_name: string | null; phone: string | null };
}

test.describe("T968 — #2093 achado 66: Meus dados avisa a falha de leitura e o salvar recusa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm().from("profiles").update({ full_name: NOME, phone: "34991230968" }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  test("falha → aviso; 'Salvar' recusa e nada é apagado; servidor de volta → sem aviso (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    const antes = await gravado();
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await dadosFalham(page, true);
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(AVISO).first(), `aviso @${largura}`).toBeVisible({ timeout: 30_000 });

      const salvar = page.getByTestId("dados-salvar");
      await salvar.scrollIntoViewIfNeeded();
      await salvar.click();
      await page.waitForTimeout(2_000);
      await expect(page.getByText(AVISO).first()).toBeVisible();
      expect(await gravado(), "nome e telefone continuam gravados").toEqual(antes);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await dadosFalham(page, false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("meus-dados")).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByText(AVISO)).toHaveCount(0);
    }
    expect(await gravado()).toEqual(antes);
    await page.context().close();
  });
});
