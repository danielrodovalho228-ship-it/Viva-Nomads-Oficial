import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T459 — PROP-1 (substitui o NAV-A2): navegação do dono, como no mockup painel-proprietario-desktop. Só no laboratório.
   1. Computador (1280): sem barra lateral; abas Início · Anúncios · Interessados · Contratos · Mensagens; sino;
      "Conta ▾" com Minha conta · Modo morador · Ajuda · Sair (E176); nenhum item de morador à vista.
   2. Subrotas: /dashboard/orcamentos acende "Interessados" e a subaba "Propostas"; /dashboard/garantias acende
      "Contratos" e "Caução".
   3. Celular (390): o topo do dono não aparece; a barra de abas do NAV-A continua.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.prop1.${sufixo}@lab.vivanomads.test`, nome: "Rui Navegação", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";

test.describe("T459 — PROP-1: navegação do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta nova de proprietário).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio PROP-1 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1–2. computador: abas no topo, Conta ▾, sem barra lateral e sem itens de morador; aba ativa nas subrotas", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const topo = page.getByTestId("topo-dono");
    await expect(topo).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("barra-lateral")).toBeHidden();
    await expect(topo.getByTestId("abas-dono").locator("a")).toHaveText(["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"]);
    await expect(topo.getByTestId("aba-dono-inicio")).toHaveAttribute("aria-current", "page");
    await expect(topo.getByTestId("sino-dono")).toBeVisible();
    // Item 4 vale para a NAVEGAÇÃO (topo e barra). O conteúdo da Início (checklist de ativação por papel, Prompt 43) é
    // do PROP-6.
    const navegacao = page.locator('[data-testid="topo-dono"], [data-testid="barra-lateral"]');
    for (const t of ["Buscar imóveis", "Buscas salvas", "Favoritos & comparações", "Meus pedidos", "Candidaturas", "Locações", "Conferência de entrada"]) {
      await expect(navegacao.getByRole("link", { name: t, exact: true }).filter({ visible: true }), t).toHaveCount(0);
    }
    await page.screenshot({ path: `${SAIDA}/t459-inicio-1280.png` });

    await topo.getByTestId("conta-dono").click();
    const menu = page.getByTestId("menu-conta-dono");
    await expect(menu.getByRole("menuitem")).toHaveText(["Minha conta", "Modo morador", "Ajuda", "Sair"]); // E176 (D2): o avatar é um atalho curto
    await page.screenshot({ path: `${SAIDA}/t459-conta-1280.png` });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await page.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aba-dono-interessados")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    const subInteressados = page.getByTestId("subabas-dono");
    await expect(subInteressados.locator("a")).toHaveText(["Interessados", "Propostas", "Fechamento", "Pedidos na cidade"]);
    await expect(page.getByTestId("subaba-dono-propostas")).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `${SAIDA}/t459-interessados-1280.png` });

    await page.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aba-dono-contratos")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    await expect(page.getByTestId("subabas-dono").locator("a")).toHaveText(["Contratos", "Caução", "Recibos e notas"]);
    await expect(page.getByTestId("subaba-dono-caucao")).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `${SAIDA}/t459-contratos-1280.png` });
    await page.context().close();
  });

  test("3. celular: sem o topo do computador; a barra de baixo com as MESMAS 5 abas (MENUS-5); subabas à vista", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("nav[data-papel]").filter({ visible: true })).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId("topo-dono")).toBeHidden();
    await expect(page.locator("nav[data-papel]").filter({ visible: true }).locator("a")).toHaveText(["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"]);
    // MENUS-5: no celular as subabas também aparecem (é o caminho para Caução, Recibos, Propostas…).
    await page.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("subabas-dono").filter({ visible: true })).toHaveCount(1, { timeout: 30_000 });
    await page.screenshot({ path: `${SAIDA}/t459-inicio-390.png` });
    await page.context().close();
  });
});
