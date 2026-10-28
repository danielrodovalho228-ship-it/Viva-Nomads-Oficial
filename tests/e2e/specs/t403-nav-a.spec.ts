import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarAdmin, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T403 — NAV-A (24/10): a barra verde é a única navegação de trabalho; a Conta é só a pessoa. 390 e 1280.
 *   1. A Conta (menu do celular e menu lateral do computador): Perfil, Como você usa a Viva, Avaliações, Dados,
 *      Privacidade, Notificações, Pagamentos, Ajuda — e Sair. Nada de Ferramentas, Painel Admin, Equipe, avisos,
 *      Verificação ou Indicações ali (nem para o admin).
 *   2. A barra verde de morador, dono e admin (todos os grupos abertos): Verificação, Ferramentas e Notificações para
 *      todos; para o admin, só "Painel admin" (ADMIN-1). Cada destino aparece uma vez só. PROP-1: no computador, o modo
 *      dono troca a barra pelo topo (abas, sino e "Conta ▾"); a mesma conta vale no topo.
 */
const SAIDA = "tests/laboratorio/saida";
const CONTA = ["Perfil", "Como você usa a Viva", "Avaliações", "Dados", "Privacidade", "Segurança e verificações", "Notificações", "Pagamentos", "Ajuda"];
const FORA_DA_CONTA = ["Seus avisos", "Ferramentas", "Painel Admin", "Equipe e aprovações", "Indicações", "Verificação", "Termos de uso", "Política de privacidade"];

test.describe("T403 — NAV-A: Conta só a pessoa; trabalho na barra verde", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const morador = { email: `inq.t403.${sufixo}@lab.vivanomads.test`, nome: "Clara Duarte", role: "tenant" as const };
  const dono = { email: `dono.t403.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  const admin = { email: `admin.t403.${sufixo}@lab.vivanomads.test`, nome: "Ada Admin" };
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

  const quantas = (barra: Locator, href: string) => barra.locator(`a[href="${href}"]`).count();
  /**
   * MENUS-5 (25/10): fora do /admin não há barra lateral nem gaveta — a navegação é o topo (abas, sino e "Conta ▾") no
   * computador e o topo do celular (sino e avatar da Conta). Abre a Conta e devolve o topo visível (o menu mora nele).
   */
  async function navegacao(p: Page, w: number): Promise<Locator> {
    const topo = (w === 1280 ? p.locator("header[data-papel]") : p.getByTestId("topo-celular")).filter({ visible: true }).first();
    await topo.waitFor({ timeout: 20_000 });
    await topo.locator('button[aria-haspopup="menu"]').first().click();
    await topo.getByRole("menu").waitFor({ timeout: 15_000 });
    return topo;
  }

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
        if (quem === "morador") await p.screenshot({ path: `${SAIDA}/t403-conta-depois-${w}.png`, fullPage: w === 390 });
        await p.context().close();
      }
    });

    test(`2. a ${w} px: a navegação (topo e Conta) de morador, dono e admin`, async ({ browser }) => {
      for (const [quem, email] of [["morador", morador.email], ["dono", dono.email], ["admin", admin.email]] as const) {
        const p = await abrir(browser, email, w, "/dashboard");
        const barra = await navegacao(p, w);
        // E176: o avatar é curto (Minha conta · Modo · Ajuda · Sair); as verificações moram na Conta ("Segurança e
        // verificações"). Na navegação fica o sino, que leva às Notificações (página única).
        expect(await quantas(barra, "/dashboard/notificacoes"), `${quem}: /dashboard/notificacoes`).toBe(1);
        // MENUS-5, item 3: as Ferramentas saíram da Conta (o dono as acha no Início).
        expect(await quantas(barra, "/dashboard/ferramentas"), `${quem}: sem Ferramentas na navegação`).toBe(0);
        const doAdmin = [await quantas(barra, "/admin"), await quantas(barra, "/admin/agentes#aprovacoes")];
        if (quem === "admin") {
          // ADMIN-1: no /dashboard o admin vê só "Painel admin"; "Equipe e aprovações" saiu da barra (aba no ADMIN-2).
          expect(doAdmin).toEqual([1, 0]);
          await expect(barra.locator('a[href="/admin"]')).toHaveText("Painel admin");
        } else {
          expect(doAdmin, quem).toEqual([0, 0]);
        }
        await semRolagemLateral(p);
        await p.screenshot({ path: `${SAIDA}/t403-barra-${quem}-${w}.png` });
        await p.context().close();
      }
    });
  }
});
