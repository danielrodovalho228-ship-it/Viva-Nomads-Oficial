import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T970 — #2106 (varredura de erros, rodada 11, achado 70): Conta › Perfil abria o formulário VAZIO quando a leitura do
 * perfil falhava — e salvar apagaria o perfil. Agora: "Não foi possível abrir o seu perfil agora. Nada foi alterado."
 * com "Tentar de novo". Pela tela real (/dashboard/conta/perfil), 390 e 1280, conta com nome e bio gravados:
 *   1. a ação que lê o perfil responde 500 (as outras passam): o aviso (perfil-leitura-falha, role=alert) no lugar do
 *      formulário — nenhum "Salvar alterações"; o banco segue igual;
 *   2. "Tentar de novo" com o servidor de volta: o formulário volta, sem o aviso.
 * O achado 71 (editar o pedido de moradia, /pedidos/novo?editar=…) segue o mesmo desenho e fica com o teste de unidade
 * do #2106.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = `Priscila Perfil ${sufixo}`;
const BIO = `Gosto de cidades pequenas e de trabalhar de manhã. t970 ${sufixo}`;
const conta = { email: `perfil.t970.${sufixo}@lab.vivanomads.test`, nome: NOME, role: "tenant" as const };
const ids: { conta?: string } = {};
const ROTA = "**/dashboard/conta/perfil**";

async function perfilFalha(page: Page, liga: boolean) {
  if (!liga) return page.unrouteAll({ behavior: "wait" });
  await page.route(ROTA, async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes(BIO)) return await r.fulfill({ status: 500, body: "falha simulada (t970)" });
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}
async function gravado() {
  const { data } = await adm().from("profiles").select("full_name, bio").eq("id", ids.conta!).single();
  return data as { full_name: string | null; bio: string | null };
}

test.describe("T970 — #2106 achado 70: Conta › Perfil avisa a falha de leitura, sem formulário vazio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm().from("profiles").update({ full_name: NOME, bio: BIO }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  test("falha → aviso sem formulário; 'Tentar de novo' → o formulário (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    const antes = await gravado();
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await perfilFalha(page, true);
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      const falha = page.getByTestId("perfil-leitura-falha");
      await expect(falha).toBeVisible({ timeout: 30_000 });
      await expect(falha).toContainText("Não foi possível abrir o seu perfil agora. Nada foi alterado.");
      await expect(falha).toHaveAttribute("role", "alert");
      await expect(page.getByTestId("perfil-salvar")).toHaveCount(0);
      expect(await gravado(), "nada alterado").toEqual(antes);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await perfilFalha(page, false);
      await page.getByTestId("perfil-leitura-tentar").click();
      await expect(page.getByTestId("perfil-leitura-falha")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('[data-testid="perfil-salvar"]').first()).toBeAttached({ timeout: 30_000 });
    }
    expect(await gravado()).toEqual(antes);
    await page.context().close();
  });
});
