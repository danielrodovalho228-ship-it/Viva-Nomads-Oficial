import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pdf } from "../fixtures/laboratorio";

/*
  T241 — Prompt 36 (390 e 1280 px), laboratório:
   2. /admin/usuarios: o admin marca uma conta de laboratório (com parceiro publicado) como teste → o parceiro some
      de /parceiros/buscar; desmarca → volta. Confirmação na página (sem window.confirm). Uma conta que NÃO é admin
      repete a mesma chamada da action e é recusada (nada muda). Cada mudança fica no moderacao_log.
   3a. /qualificar: o documento enviado COM o nome do titular → o admin vê o nome na pré-conferência; o dono troca o
      nome e salva → o admin vê o nome novo, e a fila continua com UMA linha (o salvar atualiza a mesma).
   3b. /admin/documentos: aprovar 1 de 2 → o selo "N aguardando" da barra lateral cai 1 sem recarregar a página.
   4. /admin/parceiros: marcar um item do checklist → "Salvo"; recarregar → continua marcado; erro simulado da
      action → o erro com "Tentar de novo" (que, de volta a rede, salva).
  A migração 0193 (as 5 contas de QA) é conferida no unitário (src/lib/admin/conta-teste.test.ts).
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);

const senha = novaSenha();
const sufixo = novoSufixo();
const parceiraConta = { email: `parceira.t241.${sufixo}@lab.vivanomads.test`, nome: `Paula Parceira Lab ${sufixo}`, role: "tenant" as const };
const intrusa = { email: `intrusa.t241.${sufixo}@lab.vivanomads.test`, nome: `Iara Sem Admin ${sufixo}`, role: "tenant" as const };
const donoTitular = { email: `titular.t241.${sufixo}@lab.vivanomads.test`, nome: `Tiago Titular Lab ${sufixo}`, role: "owner" as const };
const donoFila = { email: `fila.t241.${sufixo}@lab.vivanomads.test`, nome: `Fernanda Fila Lab ${sufixo}`, role: "owner" as const };
const pedidoParceria = { email: `checklist.t241.${sufixo}@lab.vivanomads.test`, nome: `Carla Checklist ${sufixo}`, role: "tenant" as const };
const slug = `paula-fotos-t241-${sufixo}`;
const ids: Record<string, string | undefined> = {};
const imoveis: Record<string, string> = {};
const BUSCA = "/parceiros/buscar?categoria=fotografia&cidade=Uberl%C3%A2ndia";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Nenhuma tela pode usar window.confirm/alert: se aparecer um diálogo, o teste falha. */
function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function admin(browser: Browser, largura: number) {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: altura(largura) } });
  const page = await ctx.newPage();
  semDialogo(page);
  return page;
}

async function isTeste(id: string) {
  const { data } = await adm().from("profiles").select("is_teste").eq("id", id).single();
  return data?.is_teste === true;
}

async function logs(id: string, acao: string) {
  const { count } = await adm().from("moderacao_log").select("id", { count: "exact", head: true }).eq("alvo_id", id).eq("acao", acao).eq("alvo_tipo", "perfil");
  return count ?? 0;
}

async function pendentes(ownerId: string) {
  const { data } = await adm().from("qualification_checklists").select("id, formulario").eq("owner_id", ownerId).eq("document_status", "pending");
  return (data ?? []) as { id: string; formulario: { elig?: { titularDocumento?: string } } | null }[];
}

test.describe("T241 — contas de teste pelo admin, titular, selo da fila e checklist salvo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.parceira = await criarConta(parceiraConta, senha);
    ids.intrusa = await criarConta(intrusa, senha);
    ids.titular = await criarConta(donoTitular, senha);
    ids.fila = await criarConta(donoFila, senha);
    ids.pedido = await criarConta(pedidoParceria, senha);
    await adm().from("limites_uso").delete().in("chave", [`doc-fila:${ids.titular}`]);
    // Parceiro publicado da conta de laboratório (o ciclo completo de publicação é o t236).
    const { error } = await adm().from("parceiros").insert({
      user_id: ids.parceira,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      nome_publico: `Paula Fotos ${sufixo}`,
      slug,
      categorias: ["fotografia"],
      cidades: ["Uberlândia"],
      descricao_curta: "Fotos de imóveis mobiliados com luz natural.",
      status: "publicado",
      publicado_em: new Date().toISOString(),
    });
    if (error) throw error;
    // Pedido de parceria pendente para o checklist (item 4).
    const { error: e2 } = await adm().from("parceiro_solicitacoes").insert({
      user_id: ids.pedido,
      email: pedidoParceria.email,
      nome: pedidoParceria.nome,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      categorias: ["fotografia"],
      cidades: ["Uberlândia"],
      portfolio_url: "https://carlachecklist.com.br",
      status: "pendente",
      origem: "site",
    });
    if (e2) throw e2;
    imoveis.titular = await criarImovelPronto(ids.titular, `Studio Titular ${sufixo}`, { ativo: false });
    imoveis.filaA = await criarImovelPronto(ids.fila, `Studio Fila A ${sufixo}`, { ativo: false, documentoPendente: donoFila.nome });
    imoveis.filaB = await criarImovelPronto(ids.fila, `Studio Fila B ${sufixo}`, { ativo: false, documentoPendente: donoFila.nome });
  });

  test.afterAll(async () => {
    if (ids.parceira) await adm().from("parceiros").delete().eq("user_id", ids.parceira);
    await adm().from("parceiro_solicitacoes").delete().eq("email", pedidoParceria.email);
    await apagarContas(Object.values(ids));
  });

  // ─────────────────────────── 2. Marcar / desmarcar conta de teste ───────────────────────────
  let actionId = "";
  let actionCorpo = "";

  for (const largura of LARGURAS) {
    const marcar = largura === 390; // 390 marca; 1280 desmarca
    test(`2. ${largura} px — admin ${marcar ? "marca" : "desmarca"} a conta de teste; o parceiro ${marcar ? "some da" : "volta para a"} busca`, async ({ browser, page }) => {
      test.setTimeout(120_000);
      semDialogo(page);
      await page.setViewportSize({ width: largura, height: altura(largura) });
      await page.goto(BUSCA, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toHaveCount(marcar ? 1 : 0, { timeout: 20_000 });

      const a = await admin(browser, largura);
      // A chamada da action fica guardada para a conta sem admin repetir (abaixo).
      a.on("request", (req) => {
        const h = req.headers()["next-action"];
        if (req.method() === "POST" && h && req.url().includes("/admin/usuarios")) {
          actionId = h;
          actionCorpo = req.postData() ?? "";
        }
      });
      const logsAntes = await logs(ids.parceira!, marcar ? "marcar_teste" : "desmarcar_teste");
      await a.goto(`/admin/usuarios?q=${encodeURIComponent(parceiraConta.nome)}&teste=sim`, { waitUntil: "domcontentloaded" });
      const linha = a.locator("[data-usuario]:visible", { hasText: parceiraConta.nome });
      await expect(linha).toHaveCount(1, { timeout: 20_000 });
      const botao = linha.getByTestId(marcar ? "marcar-teste" : "desmarcar-teste");
      await expect(botao).toHaveText(marcar ? "Marcar como conta de teste" : "Desmarcar");
      await botao.click();
      await expect(linha.getByTestId(`${marcar ? "marcar-teste" : "desmarcar-teste"}-confirmacao`)).toContainText(
        "Contas de teste ficam fora dos números reais, das buscas públicas e recebem e-mails na caixa de teste."
      );
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t241-usuarios-confirmar-${largura}.png`, fullPage: false });
      await linha.getByTestId(`${marcar ? "marcar-teste" : "desmarcar-teste"}-confirmar`).click();
      await expect.poll(() => isTeste(ids.parceira!), { timeout: 20_000 }).toBe(marcar);
      await expect(linha.getByTestId(marcar ? "desmarcar-teste" : "marcar-teste")).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => logs(ids.parceira!, marcar ? "marcar_teste" : "desmarcar_teste"), { timeout: 15_000 }).toBe(logsAntes + 1);
      await a.screenshot({ path: `${SAIDA}/t241-usuarios-${marcar ? "marcada" : "desmarcada"}-${largura}.png`, fullPage: false });
      await a.context().close();

      await page.goto(BUSCA, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toHaveCount(marcar ? 0 : 1, { timeout: 20_000 });
      // A página continua abrindo por link; marcada como teste, com noindex.
      await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      if (marcar) await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t241-parceiro-${marcar ? "teste" : "real"}-${largura}.png`, fullPage: false });
    });
  }

  test("2. conta sem admin repete a chamada da action → recusada, nada muda e nada vai para o log", async ({ browser }) => {
    test.skip(!actionId, "a chamada do admin não foi capturada (o teste de 1280 px não rodou)");
    const antes = await isTeste(ids.parceira!);
    const logsAntes = await logs(ids.parceira!, "marcar_teste");
    const page = await entrar(browser, intrusa.email, senha);
    // Mesmo corpo do admin, pedindo para MARCAR a conta (args da action: [id, true]).
    const corpo = actionCorpo.includes(ids.parceira!) ? JSON.stringify([ids.parceira, true]) : actionCorpo;
    const r = await page.request.post("/admin/usuarios", {
      headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      data: corpo,
      failOnStatusCode: false,
    });
    const texto = await r.text();
    expect(texto).not.toMatch(/"ok":true/);
    await page.waitForTimeout(1500);
    expect(await isTeste(ids.parceira!)).toBe(antes);
    expect(await logs(ids.parceira!, "marcar_teste")).toBe(logsAntes);
    // A tela do admin nem abre para quem não é admin.
    const resp = await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    expect(resp?.status() === 404 || !/\/admin\/usuarios/.test(page.url())).toBe(true);
    await page.context().close();
  });

  // ─────────────────────────── 3a. Titular no envio e no salvar ───────────────────────────
  test("3a. 390 px envia com o titular → o admin vê; 1280 px o dono troca e salva → o admin vê o novo (mesma linha)", async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await entrar(browser, donoTitular.email, senha);
    semDialogo(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/qualificar?imovel=${imoveis.titular}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Requisitos e selo" })).toBeVisible({ timeout: 20_000 });
    const campo = page.getByLabel("Nome do titular no documento");
    await campo.fill("Helena Prado Titular");
    await page.getByLabel(/Enviar documentação do imóvel/).setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByText("Enviado para conferência")).toBeVisible({ timeout: 20_000 });
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t241-qualificar-titular-390.png`, fullPage: false });
    const [linha] = await pendentes(ids.titular!);
    expect(linha?.formulario?.elig?.titularDocumento).toBe("Helena Prado Titular");

    const verNoAdmin = async (largura: number, nome: string) => {
      const a = await admin(browser, largura);
      await a.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const card = a.locator(`[data-testid="doc-card"][data-dono="${donoTitular.nome}"]`);
      await expect(card).toHaveCount(1, { timeout: 20_000 });
      await expect(card).toContainText("Titular informado pelo dono");
      await expect(card).toContainText(nome);
      await card.scrollIntoViewIfNeeded();
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t241-admin-titular-${largura}.png`, fullPage: false });
      await a.context().close();
    };
    await verNoAdmin(390, "Helena Prado Titular");

    // Troca o nome e salva a tela: a MESMA linha é atualizada (nada de segunda linha na fila).
    await page.setViewportSize({ width: 1280, height: 900 });
    await campo.fill("Helena Prado Souza");
    // "Salvar qualificação" só libera com os requisitos marcados e a convenção respondida (o do documento já veio do envio).
    for (const rotulo of ["Imóvel mobiliado completo", "Aceita período mínimo de 30 dias", "IPTU em dia", "Condições de habitabilidade (água, luz, gás)", "Proprietário ou procurador legal"]) {
      const caixa = page.getByRole("checkbox", { name: rotulo });
      if ((await caixa.getAttribute("aria-checked")) !== "true") await caixa.click();
    }
    await page.getByRole("button", { name: "Sim, permite" }).click();
    await page.getByRole("button", { name: "Salvar qualificação" }).click();
    await expect(page.getByText(/Qualificação salva/)).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await pendentes(ids.titular!)).map((l) => [l.id, l.formulario?.elig?.titularDocumento]), { timeout: 15_000 }).toEqual([
      [linha.id, "Helena Prado Souza"],
    ]);
    await page.context().close();
    await verNoAdmin(1280, "Helena Prado Souza");
  });

  // ─────────────────────────── 3b. Selo da barra lateral ───────────────────────────
  for (const largura of LARGURAS) {
    test(`3b. ${largura} px — aprovar 1 documento: o selo "aguardando" cai sem recarregar`, async ({ browser }) => {
      test.setTimeout(120_000);
      const a = await admin(browser, largura);
      await a.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const titulo = largura === 390 ? `Studio Fila A ${sufixo}` : `Studio Fila B ${sufixo}`;
      const card = a.locator(`[data-testid="doc-card"][data-imovel="${titulo}"]`);
      await expect(card).toHaveCount(1, { timeout: 20_000 });
      // O selo é o da barra lateral (no celular, a gaveta do menu).
      if (largura === 390) await a.getByRole("button", { name: "Abrir menu" }).click();
      const selo = a.locator('nav[aria-label="Menu do painel"] [data-menu-id="admin-documentos"] [aria-label$=" aguardando"]').first();
      const numero = async () => ((await selo.count()) ? Number(((await selo.getAttribute("aria-label")) ?? "0").split(" ")[0]) : 0);
      await expect.poll(numero, { timeout: 20_000 }).toBeGreaterThan(0);
      const antes = await numero();
      await a.screenshot({ path: `${SAIDA}/t241-selo-antes-${largura}.png`, fullPage: false });
      if (largura === 390) await a.mouse.click(370, 420); // toque no fundo escuro fecha a gaveta do menu
      // Marca a página: se ela recarregar, a marca some.
      await a.evaluate(() => ((window as unknown as { __t241?: number }).__t241 = 1));
      for (const cb of await card.getByRole("checkbox").all()) await cb.check();
      await card.getByRole("button", { name: "Aprovar" }).click();
      await expect(card).toHaveCount(0, { timeout: 20_000 });
      await expect.poll(numero, { timeout: 20_000 }).toBe(antes - 1);
      expect(await a.evaluate(() => (window as unknown as { __t241?: number }).__t241)).toBe(1);
      if (largura === 390 && !(await selo.isVisible())) await a.getByRole("button", { name: "Abrir menu" }).click();
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t241-selo-depois-${largura}.png`, fullPage: false });
      await a.context().close();
    });
  }

  // ─────────────────────────── 4. Checklist do parceiro: "Salvo" / "Tentar de novo" ───────────────────────────
  for (const largura of LARGURAS) {
    test(`4. ${largura} px — checklist: "Salvo", continua marcado ao recarregar; erro → "Tentar de novo"`, async ({ browser }) => {
      test.setTimeout(120_000);
      const a = await admin(browser, largura);
      const abrirFicha = async () => {
        await a.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
        const f = a.locator(`[data-testid="ficha-parceria"][data-email="${pedidoParceria.email}"]`);
        await expect(f).toBeVisible({ timeout: 20_000 });
        return f;
      };
      const item = largura === 390 ? "identidade" : "area";
      let ficha = await abrirFicha();
      await ficha.getByTestId(`check-${item}`).click();
      const estado = ficha.getByTestId(`check-estado-${item}`);
      await expect(estado).toHaveAttribute("data-fase", "salvo", { timeout: 15_000 });
      await expect(estado).toHaveText("Salvo");
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t241-checklist-salvo-${largura}.png`, fullPage: false });
      ficha = await abrirFicha();
      await expect(ficha.getByTestId(`check-${item}`)).toBeChecked();
      const { data: sol } = await adm().from("parceiro_solicitacoes").select("checklist").eq("email", pedidoParceria.email).single();
      expect((sol?.checklist as Record<string, unknown>)[item]).toBe(true);

      // Erro simulado: derruba SÓ a Server Action (POST com Next-Action) desta tela.
      const outro = largura === 390 ? "documento" : "categoria";
      let derrubar = true;
      await a.route("**/admin/parceiros**", async (route) => {
        const req = route.request();
        if (derrubar && req.method() === "POST" && req.headers()["next-action"]) return route.abort("failed");
        return route.continue();
      });
      await ficha.getByTestId(`check-${outro}`).click();
      const estadoOutro = ficha.getByTestId(`check-estado-${outro}`);
      await expect(estadoOutro).toHaveAttribute("data-fase", "erro", { timeout: 15_000 });
      await expect(ficha.getByTestId(`check-tentar-${outro}`)).toHaveText("Tentar de novo");
      await expect(ficha.getByTestId(`check-${outro}`)).not.toBeChecked();
      await a.screenshot({ path: `${SAIDA}/t241-checklist-erro-${largura}.png`, fullPage: false });
      derrubar = false;
      await ficha.getByTestId(`check-tentar-${outro}`).click();
      await expect(estadoOutro).toHaveAttribute("data-fase", "salvo", { timeout: 15_000 });
      await expect(ficha.getByTestId(`check-${outro}`)).toBeChecked();
      await a.context().close();
    });
  }
});
