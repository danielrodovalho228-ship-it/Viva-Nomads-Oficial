import { test, expect, type Browser, type Page, type Request } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T266 — Prompt 42 (painel), a 390 e 1280 px, no laboratório:
 *  1. Visão geral do proprietário abre com "Hoje você tem N decisões" — sem "Bem-vindo" nem funil de passos; cada linha
 *     é um link para a tela da decisão (contraproposta → /dashboard/propostas/<id>, contrato → /dashboard/contratos/<id>,
 *     candidatura nova → /dashboard/leads);
 *  2. proprietário novo (sem imóvel): "Nada pede sua decisão hoje" e um único primário, "Cadastrar meu imóvel";
 *  3. Conta sem capa de foto (título em texto);
 *  4. Ferramentas tem o simulador PF × PJ (/dashboard/tributacao);
 *  5. navegar por 5 telas do painel NÃO dispara nenhuma server action (POST com next-action) — os números do menu vêm
 *     de GET /api/painel/contadores.
 */
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t266.${sufixo}@lab.vivanomads.test`, nome: "Dina Decisões", role: "owner" as const };
const morador = { email: `mor.t266.${sufixo}@lab.vivanomads.test`, nome: "Mauro Decisões", role: "tenant" as const };
const morador2 = { email: `mor2.t266.${sufixo}@lab.vivanomads.test`, nome: "Marta Decisões", role: "tenant" as const };
const novo = { email: `novo.t266.${sufixo}@lab.vivanomads.test`, nome: "Nina Nova", role: "owner" as const };
const ids: { dono?: string; morador?: string; morador2?: string; novo?: string; imovel?: string; lead?: string; lead2?: string; proposta?: string; contrato?: string } = {};
const TITULO = `Studio das decisões ${sufixo}`;

const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
  return page;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
/** Primários visíveis no conteúdo (fora de navegação e janelas). */
async function primarios(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main [data-cta="primary"]'))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("nav, [role=dialog], [data-folha]");
      })
      .map((el) => (el.textContent ?? "").trim()),
  );
}

test.describe("T266 — Painel do Prompt 42", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria contas, proposta e contrato).");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.morador2 = await criarConta(morador2, senha);
    ids.novo = await criarConta(novo, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    // Candidatura nova (status "new") de outro morador → linha "Nova candidatura para …".
    ids.lead2 = await criarLead(ids.dono, ids.morador2, ids.imovel, false);

    // Proposta do dono (v1) com contraproposta do morador (v2): aberta e esperando o DONO.
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: p, error } = await adm()
      .from("propostas")
      .insert({
        numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.morador,
        status: "contraproposta", versao_atual: 2, validade_dias: 7, valida_ate: `${emDias(5)}T23:00:00Z`,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.proposta = p.id as string;
    for (const [versao, autor, valor] of [[1, "owner", 3200], [2, "tenant", 3000]] as const) {
      const { error: ev } = await adm().from("proposta_versoes").insert({
        proposta_id: ids.proposta, versao, autor, valor_base: valor, valor_mensal: valor, meses: 3, data_entrada: emDias(10),
        total_mensal: valor, total_contrato: valor * 3,
      });
      if (ev) throw ev;
    }

    // Contrato já assinado pelo morador e esperando a assinatura do dono.
    const { data: c, error: ec } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 90, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 960,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_inquilino_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (ec) throw ec;
    ids.contrato = c.id as string;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.proposta) await adm().from("propostas").delete().eq("id", ids.proposta);
    for (const l of [ids.lead, ids.lead2]) if (l) await adm().from("leads").delete().eq("id", l);
    await apagarContas([ids.dono, ids.morador, ids.morador2, ids.novo]);
  });

  for (const largura of LARGURAS) {
    test(`${largura}px — Visão geral do dono: "Hoje você tem N decisões", linhas que levam à tela da decisão`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await abrir(browser, dono.email, largura);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveText(/^Hoje você tem \d+ decis(ão|ões)$/, { timeout: 25_000 });
      await expect(page.locator("main")).not.toContainText("Bem-vindo");
      await expect(page.getByTestId("passos-proprietario")).toHaveCount(0);
      await expect(page.locator('[data-testid="painel-capa"]')).toHaveCount(0);

      const linhas = page.getByTestId("decisao");
      const n = Number((await h1.textContent())!.match(/\d+/)![0]);
      await expect(linhas).toHaveCount(n);

      const proposta = page.locator(`[data-testid="decisao"][data-decisao="proposta-${ids.proposta}"]`);
      await expect(proposta).toContainText(/Contraproposta de R\$\s?3\.000 por mês para/);
      await expect(proposta).toContainText(TITULO);
      await expect(proposta.getByTestId("decisao-prazo")).toContainText(/vence em \d+ dias/);
      await expect(proposta).toHaveAttribute("href", `/dashboard/propostas/${ids.proposta}`);

      const contrato = page.locator(`[data-testid="decisao"][data-decisao="contrato-${ids.contrato}"]`);
      await expect(contrato).toHaveText(new RegExp(`Contrato de ${TITULO} aguarda sua assinatura`));
      await expect(contrato).toHaveAttribute("href", `/dashboard/contratos/${ids.contrato}`);

      const candidatura = page.locator(`[data-testid="decisao"][data-decisao="candidatura-${ids.imovel}"]`);
      await expect(candidatura).toContainText(`Nova candidatura para ${TITULO}`);
      await expect(candidatura).toHaveAttribute("href", "/dashboard/leads");

      // Prazo primeiro: a contraproposta (vence em dias) vem antes do contrato (sem prazo).
      const ordem = await linhas.evaluateAll((els) => els.map((e) => e.getAttribute("data-decisao")));
      expect(ordem.indexOf(`proposta-${ids.proposta}`)).toBeLessThan(ordem.indexOf(`contrato-${ids.contrato}`));

      // Nada se decide aqui: a linha leva à tela da decisão.
      expect(await primarios(page)).toHaveLength(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t266-dono-decisoes-${largura}.png`, fullPage: true });
      await contrato.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/contratos/${ids.contrato}$`));
      await page.context().close();
    });

    test(`${largura}px — proprietário novo: "Nada pede sua decisão hoje" e um único primário "Cadastrar meu imóvel"`, async ({ browser }) => {
      test.setTimeout(90_000);
      const page = await abrir(browser, novo.email, largura);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nada pede sua decisão hoje", { timeout: 25_000 });
      await expect(page.getByTestId("decisao")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText("Bem-vindo");
      await expect.poll(() => primarios(page)).toEqual([expect.stringMatching(/^Cadastrar meu imóvel/)]);
      await expect(page.getByRole("link", { name: /Cadastrar meu imóvel/ })).toHaveAttribute("href", "/dashboard/imoveis/novo");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t266-dono-novo-${largura}.png`, fullPage: true });
      await page.context().close();
    });

    test(`${largura}px — Conta sem capa de foto; Ferramentas com o simulador PF × PJ`, async ({ browser }) => {
      test.setTimeout(90_000);
      const page = await abrir(browser, dono.email, largura);
      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const titulo = page.locator("main h1:visible").first();
      await expect(titulo).toHaveText("Conta", { timeout: 25_000 });
      await expect(page.locator('[data-testid="painel-capa"]')).toHaveCount(0);
      // Título em texto: o h1 fica no alto, sem uma faixa de foto antes do conteúdo.
      const caixa = await titulo.boundingBox();
      expect(caixa!.height).toBeLessThan(80);
      await semRolagemLateral(page);

      await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="painel-capa"]')).toHaveCount(0);
      const pfpj = page.locator('main a[href="/dashboard/tributacao"]').filter({ hasText: /PF × PJ/ });
      await expect(pfpj).toBeVisible({ timeout: 25_000 });
      // Grades de caixas com número par em cada grupo.
      const porGrupo = await page.getByTestId("ferramentas-grupo").evaluateAll((gs) => gs.map((g) => g.querySelectorAll('[data-testid="ferramenta-card"]').length));
      for (const n of porGrupo) expect(n % 2).toBe(0);
      await semRolagemLateral(page);
      await page.context().close();
    });

    test(`${largura}px — 5 telas do painel sem nenhuma server action da casca; contadores por GET`, async ({ browser }) => {
      test.setTimeout(150_000);
      const page = await abrir(browser, dono.email, largura);
      // Todos os grupos do menu abertos (preferência lembrada no aparelho), para clicar nos itens.
      await page.evaluate(() =>
        localStorage.setItem("vn-menu-aberto", JSON.stringify({ moradia: true, comunicacao: true, imoveis: true, contratos: true, ferramentas: true, conta: true })),
      );
      const contadores: Request[] = [];
      page.on("request", (r) => {
        if (new URL(r.url()).pathname === "/api/painel/contadores") contadores.push(r);
      });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
      await expect.poll(() => contadores.length, { timeout: 15_000 }).toBeGreaterThan(0);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      // A partir daqui, só navegação pelo menu (no celular, pela gaveta).
      const acoes: string[] = [];
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"]) acoes.push(`${r.url()} ${r.headers()["next-action"]}`);
      });
      const rotas: [string, string][] = [
        ["ferramentas-todas", "/dashboard/ferramentas"],
        ["simulador", "/dashboard/simulador"],
        ["roi", "/dashboard/roi-imovel"],
        ["tributacao", "/dashboard/tributacao"],
        ["contratos-lista", "/dashboard/contratos"],
      ];
      for (const [id, rota] of rotas) {
        if (largura === 390) await page.getByRole("button", { name: "Abrir menu" }).click();
        await page.locator(`nav[aria-label="Menu do painel"] a[data-menu-id="${id}"]:visible`).first().click();
        await expect(page).toHaveURL(new RegExp(`${rota.replace(/\//g, "\\/")}$`), { timeout: 20_000 });
        await expect(page.locator("main h1:visible").first()).toBeVisible({ timeout: 20_000 });
      }
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(acoes, "nenhuma server action ao navegar pelo painel").toEqual([]);
      for (const r of contadores) expect(r.method()).toBe("GET");
      // A casca não relê os contadores a cada rota: no máximo uma leitura por tela (montagem/foco), nunca por rota além disso.
      expect(contadores.length).toBeLessThanOrEqual(1 + rotas.length);
      const resp = await page.request.get("/api/painel/contadores");
      expect(resp.status()).toBe(200);
      expect(resp.headers()["cache-control"]).toContain("no-store");
      const corpo = await resp.json();
      expect(corpo.documentosPendentes).toBe(0);
      expect(corpo.aprovacoesPendentes).toBe(0);
      expect(corpo.temImovel).toBe(true);
      await page.context().close();
    });
  }
});
