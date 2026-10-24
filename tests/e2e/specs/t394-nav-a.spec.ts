import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarAdmin, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T394 — NAV-A (24/10): a barra verde é a única navegação de trabalho; a Conta é só a pessoa. 390 e 1280.
 *   1. A Conta (menu do celular e menu lateral do computador): Perfil, Como você usa a Viva, Avaliações, Dados,
 *      Privacidade, Notificações, Pagamentos, Ajuda — e Sair. Nada de Ferramentas, Painel Admin, Equipe, avisos,
 *      Verificação ou Indicações ali (nem para o admin).
 *   2. A barra verde de morador, dono e admin (todos os grupos abertos): Verificação, Ferramentas e Notificações para
 *      todos; para o admin, Painel Admin e Equipe e aprovações. Cada destino aparece uma vez só na barra.
 */
const SAIDA = "tests/laboratorio/saida";
const CONTA = ["Perfil", "Como você usa a Viva", "Avaliações", "Dados", "Privacidade", "Notificações", "Pagamentos", "Ajuda"];
const FORA_DA_CONTA = ["Seus avisos", "Ferramentas", "Painel Admin", "Equipe e aprovações", "Indicações", "Verificação", "Termos de uso", "Política de privacidade"];

test.describe("T394 — NAV-A: Conta só a pessoa; trabalho na barra verde", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const morador = { email: `inq.t394.${sufixo}@lab.vivanomads.test`, nome: "Clara Duarte", role: "tenant" as const };
  const dono = { email: `dono.t394.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  const admin = { email: `admin.t394.${sufixo}@lab.vivanomads.test`, nome: "Ada Admin" };
  const ids: string[] = [];
  test.beforeAll(async () => {
    ids.push(await criarConta(morador, senha));
    const idDono = await criarConta(dono, senha);
    ids.push(idDono);
    await criarImovelPronto(idDono, `Studio no Centro ${sufixo}`);
    ids.push(await criarAdmin(admin.email, admin.nome, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  async function abrir(browser: Browser, email: string, w: number, rota: string): Promise<Page> {
    const p = await entrar(browser, email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(rota, { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }
  const semRolagemLateral = async (p: Page) =>
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  /** Abre todos os grupos da barra (inclusive os de dentro) e devolve a barra visível. */
  async function barraAberta(p: Page, w: number): Promise<Locator> {
    if (w === 390) await p.getByRole("button", { name: "Abrir menu" }).first().click();
    const barra = p.getByTestId("menu-cascata").filter({ visible: true }).first();
    await barra.waitFor({ timeout: 20_000 });
    for (let i = 0; i < 6; i++) {
      const fechado = barra.locator('[data-menu-grupo] > button[aria-expanded="false"]');
      if ((await fechado.count()) === 0) break;
      await fechado.first().click();
    }
    return barra;
  }
  const quantas = (barra: Locator, href: string) => barra.locator(`a[href="${href}"]`).count();

  for (const w of [390, 1280]) {
    test(`1. a ${w} px: a Conta só tem a pessoa (também para o admin)`, async ({ browser }) => {
      for (const [quem, email] of [["morador", morador.email], ["admin", admin.email]] as const) {
        const p = await abrir(browser, email, w, w === 390 ? "/dashboard/conta" : "/dashboard/conta/dados");
        const lista = w === 390 ? p.getByTestId("conta-menu") : p.getByTestId("conta-menu-lateral");
        await lista.waitFor({ timeout: 20_000 });
        const rotulos = (await lista.locator("a").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter(Boolean);
        expect(rotulos, quem).toEqual(CONTA);
        if (w === 390) await expect(lista.getByRole("button", { name: /Sair/ })).toBeVisible();
        for (const fora of FORA_DA_CONTA) await expect(lista.getByText(fora, { exact: true }), `${quem}: ${fora}`).toHaveCount(0);
        await semRolagemLateral(p);
        if (quem === "morador") await p.screenshot({ path: `${SAIDA}/t394-conta-depois-${w}.png`, fullPage: w === 390 });
        await p.context().close();
      }
    });

    test(`2. a ${w} px: a barra verde de morador, dono e admin`, async ({ browser }) => {
      for (const [quem, email] of [["morador", morador.email], ["dono", dono.email], ["admin", admin.email]] as const) {
        const p = await abrir(browser, email, w, "/dashboard");
        const barra = await barraAberta(p, w);
        for (const href of ["/dashboard/verificacao", "/dashboard/ferramentas", "/dashboard/notificacoes"]) {
          expect(await quantas(barra, href), `${quem}: ${href}`).toBe(1);
        }
        const doAdmin = [await quantas(barra, "/admin"), await quantas(barra, "/admin/agentes#aprovacoes")];
        if (quem === "admin") {
          expect(doAdmin).toEqual([1, 1]);
          await expect(barra.locator('a[href="/admin"]')).toHaveText("Painel Admin");
          await expect(barra.locator('a[href="/admin/agentes#aprovacoes"]')).toHaveText("Equipe e aprovações");
        } else {
          expect(doAdmin, quem).toEqual([0, 0]);
        }
        await semRolagemLateral(p);
        await p.screenshot({ path: `${SAIDA}/t394-barra-${quem}-${w}.png` });
        await p.context().close();
      }
    });
  }
});
