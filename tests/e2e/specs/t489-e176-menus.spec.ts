import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T489 — E176-IMPL (especificação aprovada em docs/e176-menus-spec.md; mockups aprovados pelo Daniel em 25/10):
   1. D2 — avatar = atalho curto: Minha conta · Modo <outro papel> · Ajuda · Sair ("Sair" uma vez só).
   2. D1 — morador sem estadia vê as 5 abas (Estadia sempre); a Estadia mostra "Minhas estadias" vazia com Buscar.
   3. D1 — Contratos do dono ganha a subaba Ganhos (/dashboard/ganhos).
   4. Papel persiste — dono em modo morador vai à /buscar e volta pelo "Meu painel": continua morador.
   5. Visitas do morador: nada de "Pedidos nos meus imóveis".
   6. Voltar — Fechamento com "← Interessados" no topo e sem o "Voltar" do fim do formulário.
   7. Topo público — Imóveis · Anunciar · Empresas + Fale com a Viva + Entrar; o cabeçalho fica na /buscar; /auth com
      "Voltar ao site".
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t489.${sufixo}@lab.vivanomads.test`, nome: "Dora Menus", role: "owner" as const };
const morador = { email: `morador.t489.${sufixo}@lab.vivanomads.test`, nome: "Mara Menus", role: "tenant" as const };
const ids: Record<string, string> = {};
const MORADOR_5 = ["Início", "Buscar", "Pedidos", "Mensagens", "Estadia"];

const barra = (p: Page) => p.getByRole("navigation", { name: "Navegação principal" });

test.describe("T489 — E176-IMPL: menus conforme a especificação aprovada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio menus t489 ${sufixo}`, { ativo: true });
    // O fechamento só existe a partir de uma candidatura aceita (sem ela, a tela é a guarda "Ver interessados").
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
  });
  test.afterAll(async () => {
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — avatar curto; morador sem estadia com as 5 abas e a lista de estadias vazia`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      if (largura === 1280) {
        await expect(p.getByTestId("abas-morador").locator("a")).toHaveText(MORADOR_5, { timeout: 30_000 });
        await p.getByTestId("conta-morador").click();
        await expect(p.getByTestId("menu-conta-morador").getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda", "Sair"]);
      } else {
        await expect.poll(async () => (await barra(p).locator("a").allInnerTexts()).map((t) => t.trim()), { timeout: 30_000 }).toEqual(MORADOR_5);
        await p.getByTestId("topo-celular").getByTestId("conta-morador-celular").click();
        await expect(p.getByTestId("menu-conta-morador-celular").getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda", "Sair"]);
      }
      await expect(p.getByText("Sair", { exact: true })).toHaveCount(1);
      await p.screenshot({ path: `${SAIDA}/t489-avatar-morador-${largura}.png` });
      await p.keyboard.press("Escape");
      await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { name: "Minhas estadias" })).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText("Você ainda não tem estadias")).toBeVisible();
      await expect(p.getByRole("link", { name: "Buscar imóveis" })).toHaveAttribute("href", "/buscar");
      await p.screenshot({ path: `${SAIDA}/t489-estadia-vazia-${largura}.png` });
      // Visitas do morador: só as dele.
      await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { level: 1, name: "Visitas" })).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText("Pedidos nos meus imóveis")).toHaveCount(0);
      await p.context().close();
    });
  }

  test("1280 px — dono: avatar curto com Modo morador; Contratos com a subaba Ganhos; Fechamento com o voltar no topo", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("subabas-dono").locator("a")).toHaveText(["Contratos", "Ganhos", "Caução", "Recibos e notas"], { timeout: 30_000 });
    await p.getByTestId("subaba-dono-ganhos").click();
    await expect(p).toHaveURL(/\/dashboard\/ganhos$/);
    await expect(p.getByTestId("ganhos")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByRole("heading", { level: 1, name: "Ganhos" })).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t489-ganhos-1280.png` });
    await p.getByTestId("conta-dono").click();
    await expect(p.getByTestId("menu-conta-dono").getByRole("menuitem")).toHaveText(["Minha conta", "Modo morador", "Ajuda", "Sair"]);
    await p.screenshot({ path: `${SAIDA}/t489-avatar-dono-1280.png` });
    await p.keyboard.press("Escape");
    await p.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("voltar-lista")).toHaveText(/Interessados/, { timeout: 30_000 });
    await expect(p.getByTestId("voltar-lista")).toHaveAttribute("href", "/dashboard/leads");
    await expect(p.getByRole("button", { name: /^Voltar$/ })).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t489-fechamento-1280.png` });
    await p.context().close();
  });

  test("390 px — papel persiste: o dono em modo morador vai à /buscar e volta pelo 'Meu painel' ainda morador", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await p.getByTestId("topo-celular").getByTestId("conta-dono-celular").click({ timeout: 30_000 });
    await p.getByTestId("menu-conta-dono-celular").getByRole("menuitem", { name: "Modo morador" }).click();
    await expect.poll(async () => (await barra(p).locator("a").allInnerTexts()).map((t) => t.trim()), { timeout: 30_000 }).toEqual(MORADOR_5);
    await p.goto("/buscar", { waitUntil: "domcontentloaded" });
    // O cabeçalho público fica na /buscar (logo, links e conta).
    await expect(p.getByTestId("topo-publico")).toBeVisible({ timeout: 30_000 });
    await p.getByTestId("nav-menu").click();
    await p.getByTestId("nav-menu-lista").getByTestId("nav-meu-painel").click();
    await expect(p).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect.poll(async () => (await barra(p).locator("a").allInnerTexts()).map((t) => t.trim()), { timeout: 30_000 }).toEqual(MORADOR_5);
    await p.screenshot({ path: `${SAIDA}/t489-papel-persiste-390.png` });
    await p.context().close();
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — topo público: Imóveis · Anunciar · Empresas + Fale com a Viva + Entrar; /buscar mantém o cabeçalho; /auth com saída`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      const topo = page.getByTestId("topo-publico");
      await expect(topo).toBeVisible({ timeout: 30_000 });
      if (largura === 1280) {
        await expect(topo.getByTestId("nav-links").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas"]);
        await expect(topo.getByTestId("nav-fale-com-a-viva")).toBeVisible();
        await expect(topo.getByTestId("nav-entrar")).toHaveText("Entrar");
      } else {
        await topo.getByTestId("nav-menu").click();
        await expect(page.getByTestId("nav-menu-lista").getByRole("link")).toHaveText(["Imóveis", "Anunciar", "Empresas", "Fale com a Viva", "Entrar"]);
      }
      await page.screenshot({ path: `${SAIDA}/t489-topo-buscar-${largura}.png` });
      await page.goto("/auth", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("auth-voltar-site")).toHaveAttribute("href", "/", { timeout: 30_000 });
      await page.screenshot({ path: `${SAIDA}/t489-auth-${largura}.png` });
    });
  }
});
