import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T303 — Prompt 62-B1: avaliação do imóvel por avaliador credenciado (laboratório; a chave VISTORIA_ATIVA liga só no
 * navegador do teste, pelo cookie de laboratório). Sequência:
 *   1. credenciar 3 avaliadores (A e B pela tela; A passa por "em teste" → aprovado pelo admin) + a tabela de preço;
 *   2. o dono pede a avaliação → a designação pula o impedido (X prestou serviço ao dono há 2 meses);
 *   3. A recusa → passa ao próximo (B);
 *   4. B aceita e agenda → imóvel ocupado pede a concordância do morador → o morador concorda;
 *   5. B não aparece → o dono registra a ausência → nova designação (C), sem custo.
 */
test.describe("T303 — avaliadores credenciados (62-B1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t303.${sufixo}@lab.vivanomads.test`, nome, role });
  const dono = conta("dono", "Dora Dona", "owner");
  const morador = conta("morador", "Mauro Morador");
  const av = { A: conta("ava", "Alice Avaliadora"), B: conta("avb", "Bruno Avaliador"), C: conta("avc", "Clara Avaliadora"), X: conta("avx", "Xavier Avaliador") };
  const ids: Record<string, string> = {};
  let pedidoId = "";

  async function comChave(page: Page) {
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  }
  async function credenciamento(letra: "A" | "B" | "C" | "X") {
    const { data } = await adm().from("avaliadores_credenciamento").select("id, numero_credenciado, status").eq("parceiro_id", ids[`parc${letra}`]).maybeSingle();
    return data as { id: string; numero_credenciado: string; status: string } | null;
  }
  async function pedido() {
    const { data } = await adm().from("vistoria_pedidos").select("id, status, avaliador_id, agendado_para, concordancia_em, ocupado").eq("id", pedidoId).single();
    return data as { id: string; status: string; avaliador_id: string | null; agendado_para: string | null; concordancia_em: string | null; ocupado: boolean };
  }
  async function admin(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    return p;
  }

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    for (const l of ["A", "B", "C", "X"] as const) {
      ids[l] = await criarConta(av[l], senha);
      const { data, error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids[l], tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: av[l].nome, slug: `aval-${l.toLowerCase()}-t303-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
        .select("id")
        .single();
      if (error) throw error;
      ids[`parc${l}`] = data.id as string;
    }
    // Identidade verificada (laudo de laboratório) para quem pede pela tela.
    const ate = new Date(Date.now() + 365 * 86_400_000).toISOString();
    for (const l of ["A", "B"] as const) {
      await adm().from("tenant_verifications").insert({ tenant_id: ids[l], caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", valid_until: ate });
    }
    // C e X já credenciados (ativos). X é o 1º do rodízio, mas prestou serviço ao dono há 2 meses (impedido).
    for (const [l, ativado, ultima] of [["X", "2026-01-01T00:00:00Z", null], ["C", "2026-01-15T00:00:00Z", new Date(Date.now() - 86_400_000).toISOString()]] as const) {
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      await adm().from("avaliadores_credenciamento").insert({ parceiro_id: ids[`parc${l}`], cidade: "Uberlândia", numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: ativado, ultima_designacao_em: ultima });
    }
    await adm().from("parceiro_pedidos").insert({ codigo: `VN-SV-T303${sufixo.slice(0, 4).toUpperCase()}`, parceiro_id: ids.parcX, cliente_id: ids.dono, categoria: "fotografia", descricao: "Fotos do anúncio (laboratório)", status: "concluido", criado_em: new Date(Date.now() - 60 * 86_400_000).toISOString() });
    // Imóvel publicado (1 quarto → porte "1 ou 2 quartos"), ocupado agora pelo morador.
    ids.imovel = await criarImovelPronto(ids.dono, `Avaliação t303 ${sufixo}`, { ativo: true });
    const hoje = new Date();
    const dia = (n: number) => new Date(hoje.getTime() + n * 86_400_000).toISOString().slice(0, 10);
    const { data: c, error: eC } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: hoje.toISOString(), assinado_inquilino_em: hoje.toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.contrato = c.id as string;
    await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: dia(-10), fim: dia(50), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    // Tabela da cidade: 2 portes já salvos; o do imóvel o admin salva pela tela no caso 1.
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await adm().from("vistoria_precos").insert([
      { cidade: "Uberlândia", porte: "estudio", valor: 280 },
      { cidade: "Uberlândia", porte: "q3_mais", valor: 420 },
    ]);
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await adm().from("tenant_verifications").delete().in("tenant_id", [ids.A, ids.B].filter(Boolean));
    await apagarContas([ids.A, ids.B, ids.C, ids.X, ids.morador, ids.dono]);
  });

  test("1. credenciar 3 avaliadores: pedido pela tela (390 px), A em teste → aprovado pelo admin; tabela de preço", async ({ browser }) => {
    test.setTimeout(240_000);
    for (const l of ["A", "B"] as const) {
      const p = await entrar(browser, av[l].email, senha);
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const form = p.getByTestId("credenciamento-form");
      await form.getByLabel("Cidade onde vai avaliar").fill("Uberlândia");
      await form.getByLabel(/Portfólio ou referência/).fill("https://portfolio.lab.vivanomads.test/" + l.toLowerCase());
      await form.getByLabel(/Li e aceito o código de conduta/).check();
      await form.getByTestId("credenciamento-enviar").click();
      // A ação revalida a página (o formulário some): confere no banco e recarrega.
      await expect.poll(async () => (await credenciamento(l))?.numero_credenciado ?? "", { timeout: 20_000 }).toMatch(/^UDI-\d{3}$/);
      await p.reload();
      await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "solicitado");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      if (l === "A") await p.screenshot({ path: "tests/laboratorio/saida/t303-credenciamento-390.png", fullPage: true });
      await p.context().close();
    }
    const a = (await credenciamento("A"))!;
    // Admin: A → em teste (a fila pede a avaliação de teste) → aprovado (ativo). Duas etapas: a sessão do admin já é AAL2.
    const adm1 = await admin(browser);
    const itemA = adm1.locator(`[data-testid="credenciamento-item"][data-numero="${a.numero_credenciado}"]`);
    await itemA.getByTestId("decidir-em_teste").getByRole("button").click();
    await expect.poll(async () => (await credenciamento("A"))?.status, { timeout: 20_000 }).toBe("em_teste");
    await adm1.reload();
    await expect(adm1.locator('[data-testid="fila-item"][data-tipo="avaliacao_teste"]').first()).toBeVisible();
    await itemA.getByTestId("decidir-ativo").getByRole("button", { name: "Aprovar o teste (ativar)" }).click();
    await expect.poll(async () => (await credenciamento("A"))?.status, { timeout: 20_000 }).toBe("ativo");
    // B aprovado direto (mesmo caminho do A, coberto acima); ordem do rodízio: X (impedido) → A → B → C.
    await adm().from("avaliadores_credenciamento").update({ status: "ativo", ativado_em: "2026-03-01T00:00:00Z" }).eq("id", (await credenciamento("B"))!.id);
    await adm().from("avaliadores_credenciamento").update({ ativado_em: "2026-02-01T00:00:00Z" }).eq("id", a.id);
    // Tabela sem o porte do imóvel: a condição mostra "tabela sem valor"; o admin salva e a condição fica cumprida.
    await adm1.reload();
    const cond = adm1.locator('[data-testid="avaliadores-condicoes"][data-cidade="Uberlândia"]');
    await expect(cond.getByTestId("condicao-tabela")).toHaveAttribute("data-ok", "nao");
    await expect(cond.getByTestId("condicao-tabela")).toContainText("tabela sem valor");
    const preco = adm1.getByTestId("preco-form");
    await preco.getByLabel("Cidade").fill("Uberlândia");
    await preco.getByLabel("Porte").selectOption("q1_2");
    await preco.getByLabel("Valor (R$)").fill("350");
    await preco.getByRole("button", { name: "Salvar valor" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_precos").select("id").eq("cidade", "Uberlândia").eq("porte", "q1_2")).data ?? []).length, { timeout: 15_000 }).toBe(1);
    await adm1.reload();
    await expect(cond.getByTestId("condicao-tabela")).toHaveAttribute("data-ok", "sim");
    await expect(cond.getByTestId("condicao-avaliadores")).toHaveAttribute("data-ok", "sim");
    await expect(cond.getByTestId("condicao-parecer")).toHaveAttribute("data-ok", "nao");
    await adm1.screenshot({ path: "tests/laboratorio/saida/t303-admin-1280.png", fullPage: true });
    await adm1.context().close();
  });

  test("2. o dono pede a avaliação: valor da tabela, frase fixa e a designação pula o impedido", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    const bloco = d.getByTestId("avaliacao-dono");
    await expect(bloco.getByTestId("avaliacao-valor")).toContainText("350");
    await expect(bloco.getByTestId("frase-paga")).toHaveText("Você paga a avaliação, não o resultado.");
    await bloco.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click();
    await expect
      .poll(async () => ((await adm().from("vistoria_pedidos").select("id, status").eq("property_id", ids.imovel).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 })
      .toBe("designado");
    const { data: p } = await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel).single();
    pedidoId = p!.id as string;
    const a = (await credenciamento("A"))!;
    const x = (await credenciamento("X"))!;
    expect((await pedido()).avaliador_id).toBe(a.id);
    const { data: designados } = await adm().from("vistoria_designacoes").select("avaliador_id").eq("pedido_id", pedidoId);
    expect((designados ?? []).map((r) => r.avaliador_id)).not.toContain(x.id);
    await d.reload();
    await expect(d.getByTestId("avaliador-designado")).toHaveText(`Avaliador designado pela Viva: nº ${a.numero_credenciado}`);
    await d.setViewportSize({ width: 390, height: 844 });
    expect(await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await d.screenshot({ path: "tests/laboratorio/saida/t303-dono-390.png", fullPage: true });
    await d.context().close();
  });

  test("3. o avaliador recusa: passa ao próximo da fila", async ({ browser }) => {
    test.setTimeout(120_000);
    const p = await entrar(browser, av.A.email, senha);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`).getByTestId("designacao-recusar").click();
    const b = (await credenciamento("B"))!;
    await expect.poll(async () => (await pedido()).avaliador_id, { timeout: 20_000 }).toBe(b.id);
    await p.context().close();
  });

  test("4. B aceita e agenda; imóvel ocupado: a visita espera a concordância do morador", async ({ browser }) => {
    test.setTimeout(150_000);
    const p = await entrar(browser, av.B.email, senha);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`);
    await item.getByTestId("designacao-aceitar").click();
    await expect(item.getByTestId("agendar-visita")).toBeVisible({ timeout: 20_000 });
    const amanha = new Date(Date.now() + 2 * 86_400_000);
    const valor = `${amanha.toISOString().slice(0, 10)}T10:00`;
    await item.getByTestId("agendar-visita").getByLabel("Data e hora da visita").fill(valor);
    await item.getByTestId("agendar-visita").getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => (await pedido()).agendado_para, { timeout: 20_000 }).not.toBeNull();
    const antes = await pedido();
    // 10:00 em Brasília = 13:00 UTC.
    expect(new Date(antes.agendado_para!).toISOString().slice(11, 16)).toBe("13:00");
    expect(antes.ocupado).toBe(true);
    expect(antes.status).toBe("designado");
    expect(antes.concordancia_em).toBeNull();
    await p.context().close();

    const m = await entrar(browser, morador.email, senha);
    await comChave(m);
    await m.goto(`/dashboard/avaliacao-imovel/${pedidoId}`, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("concordancia")).toContainText("não fotografa os seus pertences");
    await m.getByTestId("concordar-visita").click();
    await expect.poll(async () => (await pedido()).status, { timeout: 20_000 }).toBe("agendado");
    expect((await pedido()).concordancia_em).not.toBeNull();
    await m.screenshot({ path: "tests/laboratorio/saida/t303-morador-390.png", fullPage: true });
    await m.context().close();
  });

  test("5. o avaliador não aparece: o dono registra a ausência e a Viva designa outro, sem custo", async ({ browser }) => {
    test.setTimeout(150_000);
    // A visita passou (data simulada no banco).
    await adm().from("vistoria_pedidos").update({ agendado_para: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("id", pedidoId);
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("ausencia-avaliador").getByRole("button", { name: "O avaliador não veio" }).click();
    const b = (await credenciamento("B"))!;
    const c = (await credenciamento("C"))!;
    await expect.poll(async () => (await pedido()).avaliador_id, { timeout: 20_000 }).toBe(c.id);
    const { data: desB } = await adm().from("vistoria_designacoes").select("resposta").eq("pedido_id", pedidoId).eq("avaliador_id", b.id).single();
    expect(desB?.resposta).toBe("ausencia");
    expect((await pedido()).status).toBe("designado");
    await d.context().close();
  });
});
