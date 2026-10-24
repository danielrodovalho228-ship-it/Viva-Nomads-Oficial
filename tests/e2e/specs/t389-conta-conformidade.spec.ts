import { readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T389 — Conformidade CONTA-A (QA do Muse, 24/10, conta sem avaliações) contra os mockups perfil-01/02/04/05. 390 e 1280.
 *   E63. Avaliações: as abas Todas/Recentes/Positivas e a busca aparecem sempre — também sem nenhuma avaliação.
 *   E64. Meus dados: sem o endereço do LinkedIn e sem o motivo da estadia.
 *   E66. Privacidade: sem a lista de segurança (E-mail/Celular/Identidade/2FA/Senha); ela mora em /dashboard/conta/seguranca,
 *        com o caminho até lá na Privacidade.
 *   E55. Perfil: as miniaturas de navegação (cabeçalho e barra lateral) mostram iniciais, não a foto.
 *   E67. Meus dados: cartão final "Seus dados, suas regras" (30 dias, link para a Privacidade); no "Quando cada dado é
 *        pedido" o estado fica alinhado num ponto só; a página termina sem vão depois do último cartão.
 */
const SAIDA = "tests/laboratorio/saida";

test.describe("T389 — Conta: E55, E63, E64, E66, E67", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const conta = { email: `inq.t389.${novoSufixo()}@lab.vivanomads.test`, nome: "Clara Duarte", role: "tenant" as const };
  let id = "";
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
    // Foto de verdade (E55 precisa dela para provar que as miniaturas viram iniciais só no Perfil).
    const up = await adm().storage.from("avatars").upload(`${id}/avatar.webp`, readFileSync("public/images/home/persona-saude.webp"), { contentType: "image/webp", upsert: true });
    if (up.error) throw up.error;
    const { error } = await adm().from("profiles").update({ avatar_url: `${id}/avatar.webp` }).eq("id", id);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  async function abrir(browser: Browser, w: number, rota: string): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(rota, { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }
  const semRolagemLateral = async (p: Page) =>
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  for (const w of [390, 1280]) {
    test(`E63. a ${w} px: abas e busca de Avaliações aparecem mesmo sem avaliação`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/avaliacoes");
      await p.getByTestId("tela-avaliacoes").waitFor({ timeout: 20_000 });
      for (const a of ["todas", "recentes", "positivas"]) await expect(p.getByTestId(`avaliacoes-aba-${a}`)).toBeVisible();
      await expect(p.getByTestId("avaliacoes-aba-todas")).toHaveAttribute("aria-current", "page");
      await expect(p.getByTestId("avaliacoes-busca")).toBeVisible();
      await expect(p.getByTestId("tela-avaliacoes")).toContainText("Nenhuma avaliação publicada ainda");
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t389-avaliacoes-${w}.png`, fullPage: true });
      await p.context().close();
    });

    test(`E64 + E67. a ${w} px: Meus dados sem LinkedIn/motivo, com o cartão final e o estado alinhado`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/dados");
      await p.getByTestId("meus-dados").waitFor({ timeout: 20_000 });
      await expect(p.getByTestId("meus-dados")).not.toContainText(/LinkedIn|Motivo da estadia/);
      await expect(p.getByTestId("perfil-motivo-estadia")).toHaveCount(0);
      // E67c: o estado de cada degrau começa no mesmo x.
      await p.getByTestId("degraus-perfil").waitFor({ timeout: 20_000 });
      const xs = await p.getByTestId("degrau-estado").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(xs.length).toBeGreaterThan(1);
      expect(new Set(xs).size, xs.join(",")).toBe(1);
      // E67b: o cartão final curto.
      const regras = p.getByTestId("seus-dados-regras");
      await expect(regras).toContainText("Seus dados, suas regras");
      await expect(regras).toContainText("30 dias");
      await expect(p.getByTestId("seus-dados-privacidade")).toHaveAttribute("href", "/dashboard/conta/privacidade");
      // E67a: no fim da rolagem não sobra vão depois do último cartão (no computador).
      if (w === 1280) {
        const vao = await p.evaluate(() => {
          const main = document.querySelector("[data-painel-main]") as HTMLElement;
          main.scrollTop = main.scrollHeight;
          window.scrollTo(0, document.documentElement.scrollHeight);
          const fimCartao = document.querySelector('[data-testid="seus-dados-regras"]')!.getBoundingClientRect().bottom;
          const fimMain = main.getBoundingClientRect().bottom;
          return Math.round(fimMain - fimCartao);
        });
        expect(vao).toBeLessThanOrEqual(48);
      }
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t389-dados-${w}.png`, fullPage: true });
      await p.context().close();
    });

    test(`E66. a ${w} px: Privacidade sem a lista de segurança; ela fica em Segurança e verificações`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/privacidade");
      await p.getByTestId("tela-privacidade").waitFor({ timeout: 20_000 });
      await expect(p.locator("main")).not.toContainText(/Alterar senha|Verificação em duas etapas|Identidade/);
      await expect(p.getByTestId("privacidade-baixar")).toBeVisible();
      await expect(p.getByTestId("privacidade-excluir")).toBeVisible();
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t389-privacidade-${w}.png`, fullPage: true });
      await p.getByTestId("privacidade-seguranca").click();
      await expect(p).toHaveURL(/\/dashboard\/conta\/seguranca$/);
      await expect(p.locator("h1:visible")).toHaveText("Segurança e verificações");
      await expect(p.locator("main")).toContainText("Alterar senha");
      await p.context().close();
    });

    test(`E55. a ${w} px: no Perfil as miniaturas de navegação mostram iniciais`, async ({ browser }) => {
      const p = await abrir(browser, w, "/dashboard/conta/perfil");
      await p.getByTestId("perfil-tela").waitFor({ timeout: 20_000 });
      await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(0);
      await expect(p.getByTestId("barra-avatar").locator("img")).toHaveCount(0);
      // O herói editável mostra a foto (uma vez); fora do Perfil, o cabeçalho volta a mostrá-la.
      await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(1, { timeout: 20_000 });
      await p.screenshot({ path: `${SAIDA}/t389-perfil-${w}.png` });
      await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(1, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
