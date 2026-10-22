import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T281 — Prompt 48, a 390 e 1280 px:
   1. busca sem resultado: "Limpar filtros", "Criar alerta desta busca" e o pedido de moradia; sem ilustração;
   2. conta nova: mensagens vazias explicam como a conversa começa (link para "Como funciona a conversa"); favoritos
      vazios levam à busca; painel sem imóvel leva a anunciar — todo estado vazio com um próximo passo, sem imagem;
   3. fila do admin vazia: "Nada pendente." com a data da última decisão (ou "nenhuma decisão ainda");
   4. carregando (rede lenta simulada): a página do imóvel, as mensagens e o admin mostram o esqueleto na geometria
      da tela — nunca um spinner solto no conteúdo.
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t281.${sufixo}@lab.vivanomads.test`, nome: "Dora Vazio Prado", role: "owner" as const };
const inq = { email: `inq.t281.${sufixo}@lab.vivanomads.test`, nome: "Iara Vazio Prado", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Segura as respostas RSC da navegação no cliente: o esqueleto da rota fica na tela tempo bastante para medir. */
async function redeLenta(page: Page, ms = 4000) {
  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"] && !route.request().headers()["next-router-prefetch"]) await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => {});
  });
}

async function navegarNoCliente(page: Page, url: string) {
  await page.evaluate((u) => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push(u), url);
}

async function semSpinnerNoConteudo(page: Page) {
  expect(await page.locator("main .animate-spin").count(), "nenhum spinner girando no conteúdo").toBe(0);
}

test.describe("T281 — esqueletos e estados vazios (Prompt 48)", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do esqueleto ${sufixo}`, { ativo: true, preco: 2900 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of LARGURAS) {
    test(`${largura}px — busca sem resultado: limpar filtros, criar alerta e pedido de moradia`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/buscar?preco=200", { waitUntil: "domcontentloaded" });
      const vazia = page.getByTestId("busca-vazia");
      await expect(vazia).toBeVisible({ timeout: 25_000 });
      await expect(vazia.getByTestId("busca-vazia-limpar")).toBeVisible();
      await expect(vazia.getByRole("button", { name: /Criar alerta desta busca/ })).toBeVisible();
      await expect(vazia.getByTestId("busca-vazia-pedido")).toHaveAttribute("href", /\/pedidos\/novo/);
      await expect(vazia.locator("img")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t281-busca-vazia-${largura}.png` });
      await vazia.getByTestId("busca-vazia-limpar").click();
      await expect(page).not.toHaveURL(/preco=200/, { timeout: 10_000 });
    });

    test(`${largura}px — conta nova: mensagens, favoritos e painel sem imóvel com o próximo passo`, async ({ browser }) => {
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      const msg = page.getByTestId("mensagens-vazio");
      await expect(msg).toBeVisible({ timeout: 25_000 });
      await expect(msg.getByRole("link", { name: /Como funciona a conversa/ })).toHaveAttribute("href", /\/como-funciona/);
      await expect(msg.getByRole("link", { name: /Buscar imóveis/ })).toHaveAttribute("href", "/buscar");
      await expect(msg.locator("img")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t281-mensagens-vazio-${largura}.png` });

      await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      const fav = page.getByTestId("estado-vazio").first();
      await expect(fav).toBeVisible({ timeout: 25_000 });
      await expect(fav.getByTestId("estado-vazio-acao").getByRole("link")).toHaveAttribute("href", "/buscar");
      await expect(fav.locator("img")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t281-favoritos-vazio-${largura}.png` });

      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const imv = page.getByTestId("estado-vazio").first();
      await expect(imv).toBeVisible({ timeout: 25_000 });
      await expect(imv.getByTestId("estado-vazio-acao").getByRole("link")).toHaveAttribute("href", "/dashboard/imoveis/novo");
      await expect(imv.locator("img")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t281-imoveis-vazio-${largura}.png` });
      await page.context().close();
    });

    test(`${largura}px — carregando: esqueleto do imóvel e das mensagens, sem spinner no conteúdo`, async ({ browser }) => {
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await redeLenta(page);

      await navegarNoCliente(page, "/dashboard/mensagens");
      await expect(page.getByTestId("skeleton-mensagens")).toBeVisible({ timeout: 3_500 });
      await semSpinnerNoConteudo(page);
      await page.screenshot({ path: `${SAIDA}/t281-esqueleto-mensagens-${largura}.png` });
      await expect(page.getByTestId("mensagens-vazio")).toBeVisible({ timeout: 25_000 });

      await navegarNoCliente(page, `/imoveis/${ids.imovel}`);
      const det = page.getByTestId("skeleton-detalhe");
      await expect(det).toBeVisible({ timeout: 3_500 });
      await semSpinnerNoConteudo(page);
      const caixa = await det.boundingBox();
      expect(caixa!.width, "o esqueleto ocupa a largura da página").toBeGreaterThan(largura * 0.8);
      await page.screenshot({ path: `${SAIDA}/t281-esqueleto-imovel-${largura}.png` });
      await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Studio do esqueleto ${sufixo}`) })).toBeVisible({ timeout: 25_000 });
      await page.context().close();
    });
  }

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    for (const largura of LARGURAS) {
      test(`${largura}px — fila vazia diz "Nada pendente." e o esqueleto do admin aparece ao navegar`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const vistas: string[] = [];
        for (const rota of ["/admin/atendimento?aba=aprovacao", "/admin/documentos", "/admin/avaliacoes", "/admin/contratos/encerramentos", "/admin/parceiros?aba=pendentes"]) {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          await expect(page.locator("h1").first()).toBeVisible({ timeout: 25_000 });
          const filas = page.getByTestId("fila-vazia");
          for (let i = 0; i < (await filas.count()); i++) {
            const f = filas.nth(i);
            await expect(f).toContainText("Nada pendente.");
            await expect(f.getByTestId("fila-vazia-ultima")).toHaveText(/Última decisão em \d{2}\/\d{2}\/\d{4}.*\(horário de Brasília\)\.|Nenhuma decisão registrada nesta fila ainda\./);
            vistas.push(rota);
          }
          await semRolagemLateral(page);
        }
        expect(vistas.length, "ao menos uma fila vazia do admin no laboratório").toBeGreaterThan(0);
        await page.goto(vistas[0], { waitUntil: "domcontentloaded" });
        await page.getByTestId("fila-vazia").first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t281-admin-fila-vazia-${largura}.png` });

        await page.goto("/admin", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await redeLenta(page);
        await navegarNoCliente(page, "/admin/usuarios");
        await expect(page.getByTestId("skeleton-admin")).toBeVisible({ timeout: 3_500 });
        await expect(page.getByTestId("skeleton-tabela")).toBeVisible();
        await semSpinnerNoConteudo(page);
        await page.screenshot({ path: `${SAIDA}/t281-esqueleto-admin-${largura}.png` });
      });
    }
  });
});
