import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T851 — LISTAS VAZIAS DE VERDADE CONTINUAM VAZIAS (Pista C, 01/11; merges #1833, #1834, #1835, #1838, #1839, #1842,
  #1856, #1859 e #1860, "Erros, achados nº 4 a 13"). As telas de lista passaram a chamar a busca com `exigir: true`: uma FALHA do banco agora lança e o painel
  mostra "Não conseguimos abrir esta tela" (painel-erro) em vez de "nenhum…". A falha do banco é do servidor (o
  navegador não a intercepta) e tem teste de unidade em cada merge. Aqui, o outro lado — o que a troca poderia quebrar:
  conta NOVA, sem nada, sem erro de banco, tem de ver o estado vazio de cada lista, nunca a tela de erro; e com um
  imóvel, "Meus imóveis" lista o imóvel.
   - proprietário novo: Meus imóveis, Interessados, Mensagens, Propostas, Visitas, Contratos, Agenda, Recibos,
     Avaliações, Ganhos e Notificações (a Carteira com menos de 3 imóveis ativos mostra a porta "Abre com 3 imóveis
     ativos" e não chega à busca com `exigir`; fica com o teste de unidade do #1859);
   - morador novo: Locações, Mensagens, Propostas, Visitas, Candidaturas, Contratos, Meus pedidos, Avaliações e os
     pedidos de serviço (Serviços › Meus pedidos);
   - com um imóvel: Pedidos na sua cidade abre (o estado vazio ou os pedidos da cidade, que outras specs podem ter
     semeado), nunca a tela de erro.
  Contas do laboratório, criadas e apagadas aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t851.${sufixo}@lab.vivanomads.test`, nome: "Lia Listas", role: "owner" as const };
const morador = { email: `mor.t851.${sufixo}@lab.vivanomads.test`, nome: "Leo Listas", role: "tenant" as const };
const ids: { dono?: string; morador?: string } = {};

type Lista = { rota: string; vazio: (p: Page) => ReturnType<Page["getByText"]> };
const titulo = (t: string) => (p: Page) => p.getByText(t, { exact: true }).first();
const DO_DONO: Lista[] = [
  { rota: "/dashboard/imoveis", vazio: titulo("Você ainda não tem imóveis") },
  { rota: "/dashboard/leads", vazio: (p) => p.getByTestId("vazio-onboarding").first() },
  { rota: "/dashboard/mensagens", vazio: (p) => p.getByTestId("mensagens-vazio") },
  { rota: "/dashboard/propostas", vazio: titulo("Nenhuma proposta por enquanto") },
  { rota: "/dashboard/visitas", vazio: titulo("Nenhuma visita ainda") },
  { rota: "/dashboard/contratos", vazio: titulo("Nenhum contrato ainda") },
  { rota: "/dashboard/agenda", vazio: titulo("Nenhum imóvel ainda") },
  { rota: "/dashboard/recibos", vazio: titulo("Nenhum documento neste mês") },
  { rota: "/dashboard/avaliacoes", vazio: titulo("Nenhuma avaliação publicada ainda") },
  { rota: "/dashboard/ganhos", vazio: titulo("Nenhum contrato em vigência ainda") },
  { rota: "/dashboard/notificacoes", vazio: (p) => p.getByText(/Nenhuma atualização por enquanto/).first() },
];
const DO_MORADOR: Lista[] = [
  { rota: "/dashboard/locacoes", vazio: titulo("Você ainda não tem estadias") },
  { rota: "/dashboard/mensagens", vazio: (p) => p.getByTestId("mensagens-vazio") },
  { rota: "/dashboard/propostas", vazio: titulo("Nenhuma proposta por enquanto") },
  { rota: "/dashboard/visitas", vazio: titulo("Nenhuma visita ainda") },
  { rota: "/dashboard/candidaturas", vazio: titulo("Você ainda não se candidatou") },
  { rota: "/dashboard/contratos", vazio: titulo("Nenhum contrato ainda") },
  { rota: "/dashboard/pedidos", vazio: (p) => p.getByTestId("vazio-onboarding").first() },
  { rota: "/dashboard/avaliacoes", vazio: titulo("Nenhuma avaliação publicada ainda") },
  { rota: "/dashboard/servicos", vazio: (p) => p.getByTestId("servicos-pedidos").getByText("Nenhum pedido ainda", { exact: true }) },
];

async function conferirVazias(page: Page, listas: Lista[], papel: string): Promise<void> {
  for (const l of listas) {
    await test.step(`${papel} ${l.rota}: estado vazio, sem tela de erro`, async () => {
      const r = await page.goto(l.rota, { waitUntil: "domcontentloaded" });
      expect(r?.status(), `${l.rota} HTTP`).toBeLessThan(400);
      await expect(l.vazio(page), `${l.rota}: o estado vazio`).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("painel-erro"), `${l.rota}: não pode cair na tela de erro`).toHaveCount(0);
    });
  }
}

test.describe("T851 — listas vazias de verdade continuam vazias, sem a tela de erro (#1833–#1835, #1838, #1839, #1842, #1856, #1859, #1860)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  test("proprietário novo: cada lista mostra o estado vazio", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await conferirVazias(page, DO_DONO, "dono");
    await page.context().close();
  });

  test("morador novo: cada lista mostra o estado vazio", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, morador.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await conferirVazias(page, DO_MORADOR, "morador");
    await page.context().close();
  });

  test("com um imóvel, Meus imóveis lista o imóvel e Pedidos na sua cidade abre (sem tela de erro)", async ({ browser }) => {
    test.setTimeout(120_000);
    await criarImovelPronto(ids.dono!, `Studio Listas t851 ${sufixo}`, { ativo: true });
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="estado-anuncio"]')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByText(`Studio Listas t851 ${sufixo}`).first()).toBeVisible();
    await expect(page.getByText("Você ainda não tem imóveis", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("painel-erro")).toHaveCount(0);

    // #1839: Pedidos na sua cidade (só faz sentido com imóvel) abre — vazio ou com os pedidos da cidade —, sem a tela de erro.
    const r = await page.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByTestId("pedidos-dono-vazio").or(page.getByTestId("pedido-dono-cartao").first())).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("painel-erro")).toHaveCount(0);
    await page.context().close();
  });
});
