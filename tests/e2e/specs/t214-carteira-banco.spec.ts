import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { formatarDiaCurto } from "../../../src/lib/estadia-linha-tempo";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T214 — Complemento do prompt 27, item 8 (reteste do Muse no #858): a Análise da carteira lê o BANCO.
  Massa igual à do proprietario1 em produção: 1 imóvel em vigência (R$ 3.200) + a carteira de teste semeada pelo admin
  (Carteira 1 e 2 com contrato concluído → vagos; Carteira 3 aguardando o 1º pagamento → reservado, R$ 3.600).
  Esperado: 4 ativos · 1 ocupado · 1 reservado · 2 vagos · 25% · R$ 3.200 em vigência · R$ 3.600 a começar.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string | undefined> = {};
const dono = { email: `dono.t214.${sufixo}@lab.vivanomads.test`, nome: "Otávio Carteira Sobrenome", role: "owner" as const };
const inq = { email: `inq.t214.${sufixo}@lab.vivanomads.test`, nome: "Iara Morada Sobrenome", role: "tenant" as const };
const dono2 = { email: `dono2.t214.${sufixo}@lab.vivanomads.test`, nome: "Rita Umimovel Sobrenome", role: "owner" as const };
const TITULO_VIGENTE = `Studio Santa Mônica ${sufixo}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function apagarContratosDe(ownerId: string | undefined) {
  if (!ownerId) return;
  const { data: props } = await adm().from("properties").select("id").eq("owner_id", ownerId);
  const pids = ((props ?? []) as { id: string }[]).map((p) => p.id);
  if (!pids.length) return;
  const { data: cs } = await adm().from("contratos").select("id").in("property_id", pids);
  const cids = ((cs ?? []) as { id: string }[]).map((c) => c.id);
  if (cids.length) {
    await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
    await adm().from("contrato_blocos").delete().in("contrato_id", cids);
    await adm().from("contratos").delete().in("id", cids);
  }
}

test.describe("T214 — Análise da carteira ligada ao banco (complemento do prompt 27)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.dono2 = await criarConta(dono2, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq, ids.dono2]);
    // O imóvel em vigência (o "Santa Mônica" do proprietario1).
    ids.vigente = await criarImovelPronto(ids.dono, TITULO_VIGENTE, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ address: "Santa Mônica" }).eq("id", ids.vigente);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.vigente,
        tenant_id: ids.inq,
        owner_plan: "free",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.12,
        comissao_valor: 768,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contratoVigente = c.id as string;
    await tornarContratoVigente(ids.contratoVigente, ids.dono!, 3200);
    // O dono com 1 imóvel só (a tela continua fechada).
    await criarImovelPronto(ids.dono2, `Studio único ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    await apagarContratosDe(ids.dono);
    await apagarContas([ids.inq, ids.dono, ids.dono2]);
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("1. 1280 — o admin semeia a carteira de teste do dono", async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await abrir(page, "/admin/dados-de-teste");
      await page.getByTestId("carteira-proprietario").selectOption(ids.dono!);
      await page.getByTestId("carteira-inquilino").selectOption(ids.inq!);
      await page.getByTestId("carteira-semear").click();
      await page.getByTestId("carteira-confirmar").click();
      await expect(page.getByTestId("carteira-ok")).toContainText("3 imóveis ativos e 3 contratos", { timeout: 30_000 });
      ids.semeada = "1";
    });
  });

  for (const largura of [390, 1280]) {
    test(`2. ${largura} — /dashboard/carteira abre com a tabela e os indicadores do banco; o link do contrato abre a página certa`, async ({ browser }) => {
      test.setTimeout(150_000);
      test.skip(!ids.semeada, "depende da carteira semeada no passo 1");
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(p, "/dashboard/carteira");
      await expect(p.getByTestId("carteira-analise")).toBeVisible({ timeout: 25_000 });
      await expect(p.getByText("Sua carteira está vazia")).toHaveCount(0);

      // Indicadores.
      await expect(p.getByTestId("carteira-ind-ativos")).toHaveAttribute("data-valor", "4");
      await expect(p.getByTestId("carteira-ind-ocupacao")).toHaveAttribute("data-valor", "25");
      await expect(p.getByTestId("carteira-ind-ocupacao")).toContainText("25%");
      await expect(p.getByTestId("carteira-ind-ocupacao")).toContainText("1 de 4 ocupados");
      await expect(p.getByTestId("carteira-ind-reservados")).toHaveAttribute("data-valor", "1");
      await expect(p.getByTestId("carteira-ind-vagos")).toHaveAttribute("data-valor", "2");
      await expect(p.getByTestId("carteira-ind-receita")).toContainText("3.200");
      await expect(p.getByTestId("carteira-ind-a-comecar")).toContainText("3.600");
      await expect(p.getByTestId("carteira-formulas")).toContainText("Ocupação = imóveis ocupados ÷ imóveis ativos");
      await expect(p.getByTestId("carteira-formulas")).toContainText("A taxa de serviço não entra");

      // Tabela: 4 linhas, uma por imóvel ativo.
      const linhas = p.getByTestId("carteira-linha");
      await expect(linhas).toHaveCount(4);
      await expect(p.locator('[data-testid="carteira-linha"][data-situacao="ocupado"]')).toHaveCount(1);
      await expect(p.locator('[data-testid="carteira-linha"][data-situacao="reservado"]')).toHaveCount(1);
      await expect(p.locator('[data-testid="carteira-linha"][data-situacao="vago"]')).toHaveCount(2);
      const ocupada = p.locator('[data-testid="carteira-linha"][data-situacao="ocupado"]');
      await expect(ocupada).toContainText(TITULO_VIGENTE);
      await expect(ocupada).toContainText("Iara S.");
      await expect(p.locator('[data-testid="carteira-linha"][data-situacao="reservado"]')).toContainText("[TESTE QA] Carteira 3");
      await expect(p.getByTestId("carteira-vago")).toHaveCount(2);
      await expect(p.getByTestId("carteira-pedidos-compativeis").first()).toHaveAttribute("href", /\/dashboard\/pedidos-cidade\?imovel=/);
      // Vencimentos pelos blocos: o vigente termina em 59 dias (31–60) e a Carteira 3 em 69 (61–90).
      await expect(p.getByTestId("carteira-vence-60")).toContainText(TITULO_VIGENTE);
      await expect(p.getByTestId("carteira-vence-90")).toContainText("[TESTE QA] Carteira 3");
      await expect(p.getByTestId("carteira-preparar-renovacao").first()).toBeVisible();
      await expect(p.locator("main")).not.toContainText(/aluguel/i);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t214-carteira-${largura}.png`, fullPage: true });

      // O link do contrato abre a página certa, com as mesmas datas (Entrada / Saída dos blocos).
      const inicio = (await ocupada.getByTestId("carteira-inicio").innerText()).trim();
      const fim = (await ocupada.getByTestId("carteira-fim").innerText()).split("\n")[0].trim();
      const iso = (br: string) => `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;
      const link = ocupada.getByTestId("carteira-contrato");
      await expect(link).toHaveText(ids.contratoVigente!.slice(0, 8));
      await link.click();
      await p.waitForURL(new RegExp(`/dashboard/contratos/${ids.contratoVigente}$`), { timeout: 20_000 });
      await expect(p.getByTestId("contrato-resumo")).toContainText(`Contrato ${ids.contratoVigente}`);
      await expect(p.getByTestId("estadia-etapa-entrada")).toContainText(formatarDiaCurto(iso(inicio)));
      await expect(p.getByTestId("estadia-etapa-saida")).toContainText(formatarDiaCurto(iso(fim)));
      const { data: blocos } = await adm().from("contrato_blocos").select("inicio, fim").eq("contrato_id", ids.contratoVigente!);
      expect(inicio).toBe(dataBR(String(blocos![0].inicio)));
      expect(fim).toBe(dataBR(String(blocos![0].fim)));
      await p.context().close();
    });
  }

  for (const largura of [390, 1280]) {
    test(`3. ${largura} — com menos de 3 imóveis ativos a tela continua fechada`, async ({ browser }) => {
      test.setTimeout(90_000);
      const p = await entrar(browser, dono2.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(p, "/dashboard/carteira");
      await expect(p.getByTestId("carteira-fechada")).toContainText("Abre com 3 imóveis ativos");
      await expect(p.getByTestId("carteira-analise")).toHaveCount(0);
      await semRolagemLateral(p);
      await p.context().close();
    });
  }
});
