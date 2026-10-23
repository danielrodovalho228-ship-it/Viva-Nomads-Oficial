import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  CHAVE_ANON,
  NO_LABORATORIO,
  URL_SUPABASE,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  definirPlano,
  entrar,
  novaSenha,
  novoSufixo,
  publicarPeloEditor,
  statusDoImovel,
  tornarContratoVigente,
} from "../fixtures/laboratorio";
import { CHAVES_CONFORTO, ITENS_CONFORTO } from "../../../src/config/conforto-minimo";

/*
  T292 — Prompt 59 (Fase 1): padrão mínimo de conforto + prazo de solução da manutenção. Só no laboratório.
  Datas simuladas movendo as linhas no banco e rodando a rotina dos prazos pelo admin (/admin/conforto), isolada no
  imóvel do spec (os outros specs rodam ao mesmo tempo).
   1. Publicar sem 1 item é recusado: a revisão mostra o que falta e o banco recusa a publicação direta; com os 10, publica.
   2. Anúncio já publicado: lembrete aos 15 dias; no dia 31 sai da busca (pausado); o dono não republica sem confirmar;
      confirmou → volta.
   3. Conferência de entrada: morador marca "não confere" em 2 itens → 2 pendências; dono corrige uma e contesta a outra;
      morador confirma a correção; o atendimento decide a contestação (procedente).
   4. Urgente: provisória às 20 h e definitiva às 80 h → "Fora do prazo" (59-A); o morador confirma.
   5. Reclassificação: o dono só pede (o banco recusa mudar a prioridade); o admin reclassifica com motivo → prazos
      recalculados da abertura (baixa 168 h → média 72 h: vencida), fila "Manutenção fora do prazo" e "o proprietário
      foi avisado em [hora]" para o morador.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.conforto.${sufixo}@lab.vivanomads.test`, nome: "Olga Conforto", role: "owner" as const };
const inquilino = { email: `inq.conforto.${sufixo}@lab.vivanomads.test`, nome: "Ivo Conforto", role: "tenant" as const };
const T = {
  novo: `Studio do padrão mínimo ${sufixo}`,
  antigo: `Apartamento antigo do conforto ${sufixo}`,
  contrato: `Casa da conferência do conforto ${sufixo}`,
};
const URGENTE = `Sem água quente no banheiro (${sufixo}).`;
const BAIXA = `Puxador do armário solto (${sufixo}).`;
const H = 3_600_000;
const ids: { assistente?: string; dono?: string; inquilino?: string; novo?: string; antigo?: string; casa?: string; lead?: string; contrato?: string; urgente?: string; baixa?: string } = {};

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

async function admin(browser: Browser, largura = 1280): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return page;
}

/** Sessão do dono direto no banco (a mesma chave pública do site): prova que a trava é do banco, não só da tela. */
async function clienteDoDono() {
  const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: dono.email, password: senha });
  if (error) throw error;
  return c;
}

/** Roda a rotina dos prazos pelo admin, só no imóvel indicado, com a data simulada (fora do silêncio das 22h–7h). */
async function rodarPrazos(browser: Browser, imovel: string, agora = new Date()) {
  const a = await admin(browser);
  await a.goto("/admin/conforto", { waitUntil: "domcontentloaded" });
  await a.getByTestId("rodar-prazos-agora").fill(agora.toISOString());
  await a.getByTestId("rodar-prazos-imovel").fill(imovel);
  await a.getByTestId("rodar-prazos").click();
  await expect(a.getByTestId("rodar-prazos-resultado")).toContainText("Feito:", { timeout: 60_000 });
  await a.context().close();
}

/** Próximo meio-dia em Brasília a partir de agora (o aviso não urgente não sai no silêncio). */
function meioDiaBrasilia(): Date {
  const d = new Date();
  const h = Number(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
  if (h >= 7 && h < 22) return d;
  return new Date(d.getTime() + (h >= 22 ? 24 - h + 12 : 12 - h) * H);
}

test.describe("T292 — Prompt 59: padrão mínimo de conforto e prazo de solução da manutenção", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    // Plano com folga de anúncios: o dono tem 2 ativos (antigo e casa) e publica o 3º no caso 1 (Gratuito = 1).
    await definirPlano(ids.dono, "pro");
    ids.novo = await criarImovelPronto(ids.dono, T.novo, { semConforto: true });
    // 59-A: o assistente (passo Comodidades → Revisão) roda num rascunho só dele — o salvamento automático regrava as
    // colunas e as fotos a partir do estado do assistente, e o rascunho "novo" precisa delas intactas para publicar.
    ids.assistente = await criarImovelPronto(ids.dono, `${T.novo} (assistente)`, { semConforto: true });
    await adm().from("properties").update({ draft_data: { title: T.novo, monthlyPrice: "3200", garantias: { caucao: true }, step: 3, ordemEtapas: 4, etapaMax: 5 } }).eq("id", ids.assistente);
    ids.antigo = await criarImovelPronto(ids.dono, T.antigo, { ativo: true, semConforto: true });
    ids.casa = await criarImovelPronto(ids.dono, T.contrato, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inquilino, ids.casa, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.casa,
        tenant_id: ids.inquilino,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. publicar sem 1 item é recusado com a lista do que falta; com os 10, publica", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    // Prompt 59-A: o checklist fica no passo Comodidades; a Revisão diz o que falta junto do Publicar.
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.assistente}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
    const checklist = page.getByTestId("conforto-checklist");
    await expect(checklist).toBeVisible({ timeout: 30_000 });
    // A lista do padrão mínimo vem da constante (12 itens na versão 2, #1086): o teste acompanha se ela mudar.
    await expect(page.getByTestId("conforto-faltam")).toHaveText(`Faltam confirmar ${ITENS_CONFORTO.length} itens.`);
    await page.getByTestId("conforto-marcar-todos").click();
    await page.getByTestId(`conforto-item-${CHAVES_CONFORTO[0]}`).getByRole("checkbox").uncheck();
    await expect(page.getByTestId("conforto-faltam")).toHaveText("Falta confirmar 1 item.");
    await page.getByTestId("cadastro-continuar").click();
    await page.getByTestId("cadastro-continuar").click();
    await expect(page.getByTestId("etapa-revisar").getByTestId("checklist-item-conforto")).toHaveAttribute("data-ok", "0", { timeout: 20_000 });
    await expect(page.getByTestId("publicar-falta-conforto")).toContainText(`Falta confirmar: ${ITENS_CONFORTO[0].rotulo}.`);
    await expect(page.getByTestId("publicar-anuncio")).toBeDisabled();
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t292-1-falta-1-item-390.png", fullPage: true });

    // A trava do banco: mesmo pulando a tela, o anúncio não vira "ativo".
    const c = await clienteDoDono();
    const { error } = await c.from("properties").update({ status: "active" }).eq("id", ids.novo!);
    expect(error?.message ?? "").toContain("padrão mínimo");
    expect(await statusDoImovel(ids.novo!)).toBe("draft");

    // Confirmou os 10 (pela página do padrão mínimo) → o editor publica.
    await page.goto(`/dashboard/imoveis/${ids.novo}/conforto`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("conforto-marcar-todos").click();
    await page.getByTestId("conforto-salvar").click();
    await expect(page.getByTestId("conforto-resultado")).toHaveText("Padrão mínimo confirmado.", { timeout: 20_000 });
    await publicarPeloEditor(page, ids.novo!);
    await expect.poll(() => statusDoImovel(ids.novo!), { timeout: 30_000 }).toBe("active");
    await page.context().close();
  });

  test("2. anúncio já publicado: lembrete aos 15 dias, sai da busca no dia 31 e volta ao confirmar", async ({ browser }) => {
    const agora = Date.now();
    await adm().from("conforto_adequacao").upsert({ property_id: ids.antigo, prazo_ate: new Date(agora + 15 * 24 * H - H).toISOString(), lembretes: [], pausado_em: null });
    await rodarPrazos(browser, ids.antigo!);
    const { data: d15 } = await adm().from("conforto_adequacao").select("lembretes, pausado_em").eq("property_id", ids.antigo!).single();
    expect(d15?.lembretes).toEqual([15]);
    expect(d15?.pausado_em).toBeNull();
    expect(await statusDoImovel(ids.antigo!)).toBe("active");

    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.antigo}/conforto`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conforto-aviso")).toContainText("Confirme o padrão mínimo até", { timeout: 20_000 });

    // Dia 31: o prazo venceu ontem.
    await adm().from("conforto_adequacao").update({ prazo_ate: new Date(agora - 24 * H).toISOString() }).eq("property_id", ids.antigo!);
    await rodarPrazos(browser, ids.antigo!);
    expect(await statusDoImovel(ids.antigo!)).toBe("paused");
    const c = await clienteDoDono();
    const { error } = await c.from("properties").update({ status: "active" }).eq("id", ids.antigo!);
    expect(error?.message ?? "").toContain("padrão mínimo");
    expect(await statusDoImovel(ids.antigo!)).toBe("paused");

    await page.goto(`/dashboard/imoveis/${ids.antigo}/conforto`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("conforto-marcar-todos").click();
    await page.getByTestId("conforto-salvar").click();
    await expect(page.getByTestId("conforto-resultado")).toHaveText("Padrão mínimo confirmado.", { timeout: 20_000 });
    await expect.poll(() => statusDoImovel(ids.antigo!), { timeout: 20_000 }).toBe("active");
    const { data: volta } = await adm().from("conforto_adequacao").select("pausado_em").eq("property_id", ids.antigo!).single();
    expect(volta?.pausado_em).toBeNull();
    await page.context().close();
  });

  test("3. 'não confere' na entrada → pendência; dono corrige, morador confirma; contestação decidida pelo atendimento", async ({ browser }) => {
    const [itemA, itemB] = [CHAVES_CONFORTO[0], CHAVES_CONFORTO[2]];
    const morador = await entrar(browser, inquilino.email, senha);
    await morador.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(morador.getByTestId("conforto-entrada-form")).toBeVisible({ timeout: 30_000 });
    for (const k of CHAVES_CONFORTO) {
      if (k === itemA || k === itemB) {
        await morador.getByTestId(`conforto-nao-confere-${k}`).check();
        await morador.getByTestId(`conforto-texto-${k}`).fill(k === itemA ? "Colchão afundado no meio." : "Chuveiro só sai frio.");
      } else await morador.getByTestId(`conforto-confere-${k}`).check();
    }
    await semRolagemLateral(morador);
    await morador.getByTestId("conforto-entrada-enviar").click();
    // O que acabou de ser enviado aparece na hora, sem erro; as 2 respostas "não confere" ficam marcadas.
    await expect(morador.getByTestId("conforto-entrada-respondida")).toBeVisible({ timeout: 20_000 });
    await expect(morador.getByTestId("conforto-entrada-erro")).toHaveCount(0);
    await expect(morador.locator('[data-testid^="conforto-entrada-"][data-confere="0"]')).toHaveCount(2);
    const { data: pend } = await adm().from("conforto_pendencias").select("chave, status").eq("contrato_id", ids.contrato!);
    expect((pend ?? []).map((p) => p.chave).sort()).toEqual([itemA, itemB].sort());
    expect((pend ?? []).every((p) => p.status === "aberta")).toBe(true);

    const donoPg = await entrar(browser, dono.email, senha);
    await donoPg.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const pa = donoPg.locator(`[data-testid="pendencia-conforto"][data-chave="${itemA}"]`);
    const pb = donoPg.locator(`[data-testid="pendencia-conforto"][data-chave="${itemB}"]`);
    await expect(pa.getByTestId("pendencia-conforto-prazo")).toContainText("Corrigir até", { timeout: 20_000 });
    await pa.getByTestId("pendencia-corrigido").click();
    await expect(pa).toHaveAttribute("data-status", "corrigida", { timeout: 20_000 });
    await pb.getByTestId("pendencia-contestar").click();
    await pb.getByTestId("pendencia-motivo").fill("O chuveiro foi trocado na semana da entrega.");
    await pb.getByTestId("pendencia-enviar-contestacao").click();
    await expect(pb).toHaveAttribute("data-status", "contestada", { timeout: 20_000 });
    await donoPg.context().close();

    await morador.reload({ waitUntil: "domcontentloaded" });
    const ma = morador.locator(`[data-testid="pendencia-conforto"][data-chave="${itemA}"]`);
    await ma.getByTestId("pendencia-confirmar").click();
    await expect(ma).toHaveAttribute("data-fechada", "1", { timeout: 20_000 });
    // O morador não decide a contestação (nem vê botão para isso).
    await expect(morador.locator(`[data-testid="pendencia-conforto"][data-chave="${itemB}"]`).getByRole("button")).toHaveCount(0);
    await morador.context().close();

    const a = await admin(browser);
    await a.goto("/admin/conforto", { waitUntil: "domcontentloaded" });
    const linha = a.getByTestId("contestacao-linha").filter({ hasText: T.contrato });
    await expect(linha).toContainText("Chuveiro só sai frio.", { timeout: 20_000 });
    await linha.getByTestId("contestacao-procedente").click();
    await expect(a.getByTestId("contestacao-linha").filter({ hasText: T.contrato })).toHaveCount(0, { timeout: 20_000 });
    await a.context().close();
    const { data: fim } = await adm().from("conforto_pendencias").select("chave, status").eq("contrato_id", ids.contrato!);
    expect(Object.fromEntries((fim ?? []).map((p) => [p.chave, p.status]))).toEqual({ [itemA]: "corrigida", [itemB]: "procedente" });
  });

  test("4. urgente: provisória às 20 h e definitiva às 80 h → 'Fora do prazo'", async ({ browser }) => {
    const abertura = Date.now() - 80 * H;
    const { data, error } = await adm()
      .from("service_orders")
      .insert({
        property_id: ids.casa,
        tenant_id: ids.inquilino,
        owner_id: ids.dono,
        category: "hidraulica",
        priority: "urgente",
        description: URGENTE,
        status: "em_andamento",
        opened_at: new Date(abertura).toISOString(),
        first_response_at: new Date(abertura + H).toISOString(),
        provisoria_em: new Date(abertura + 20 * H).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.urgente = data.id as string;

    // O dono marca a definitiva agora (80 h depois da abertura).
    const donoPg = await entrar(browser, dono.email, senha);
    await donoPg.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
    const ordem = donoPg.getByTestId("ordem-manutencao").filter({ hasText: URGENTE });
    await expect(ordem.getByTestId("solucao-ordem")).toHaveAttribute("data-estado", "vencido", { timeout: 20_000 });
    await ordem.getByTestId("solicitacao-cartao").click();
    await ordem.getByRole("button", { name: "Marcar como resolvida" }).click();
    await expect(ordem.getByTestId("status-ordem")).toHaveText("Resolvida", { timeout: 20_000 });
    await expect(ordem.getByTestId("solucao-estado")).toHaveText("Fora do prazo");
    await donoPg.context().close();

    const morador = await entrar(browser, inquilino.email, senha);
    await morador.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
    const mo = morador.getByTestId("ordem-manutencao").filter({ hasText: URGENTE });
    await expect(mo.getByTestId("solucao-ordem")).toHaveAttribute("data-estado", "resolvido_fora", { timeout: 20_000 });
    await mo.getByTestId("solicitacao-cartao").click();
    await mo.getByTestId("ordem-confirmar-solucao").click();
    await expect(mo.getByTestId("ordem-confirmar-solucao")).toHaveCount(0, { timeout: 20_000 });
    await semRolagemLateral(morador);
    await morador.screenshot({ path: "tests/laboratorio/saida/t292-4-urgente-fora-390.png", fullPage: true });
    await morador.context().close();
    const { data: so } = await adm().from("service_orders").select("status, solucao_marcada_em, solucao_confirmada_em").eq("id", ids.urgente).single();
    expect(so?.status).toBe("resolvido");
    expect(so?.solucao_marcada_em).toBeTruthy();
    expect(so?.solucao_confirmada_em).toBeTruthy();
  });

  test("5. o dono não reclassifica; o admin reclassifica com motivo e os prazos recalculam", async ({ browser }) => {
    const abertura = Date.now() - 100 * H;
    const { data, error } = await adm()
      .from("service_orders")
      .insert({ property_id: ids.casa, tenant_id: ids.inquilino, owner_id: ids.dono, category: "outros", priority: "baixa", description: BAIXA, status: "aberto", opened_at: new Date(abertura).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.baixa = data.id as string;

    // Dono: a tela só deixa PEDIR; o banco recusa mudar a prioridade.
    const c = await clienteDoDono();
    const { error: eDono } = await c.from("service_orders").update({ priority: "media" }).eq("id", ids.baixa);
    expect(eDono?.message ?? "").toContain("Só o atendimento da Viva");
    const donoPg = await entrar(browser, dono.email, senha);
    await donoPg.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
    const ordem = donoPg.getByTestId("ordem-manutencao").filter({ hasText: BAIXA });
    await expect(ordem.getByTestId("solucao-ordem")).toHaveAttribute("data-estado", "no_prazo", { timeout: 20_000 });
    await ordem.getByTestId("solicitacao-cartao").click();
    await ordem.getByTestId("ordem-pedir-reclassificacao").click();
    await ordem.getByTestId("ordem-motivo-reclassificacao").fill("Armário é da cozinha e a porta cai sozinha.");
    await ordem.getByTestId("ordem-enviar-reclassificacao").click();
    await expect(ordem).toContainText("Pedido de reclassificação enviado", { timeout: 20_000 });
    await donoPg.context().close();
    const { data: pedido } = await adm().from("service_orders").select("priority, reclassificacao_pedida_em").eq("id", ids.baixa).single();
    expect(pedido?.priority).toBe("baixa");
    expect(pedido?.reclassificacao_pedida_em).toBeTruthy();

    // Admin (AAL2) reclassifica: baixa (168 h) → média (72 h), contado da abertura → vencida.
    const a = await admin(browser);
    await a.goto("/admin/solicitacoes?reclassificacao=1", { waitUntil: "domcontentloaded" });
    const linha = a.getByTestId("solicitacao-linha").filter({ hasText: T.contrato });
    await linha.getByTestId("admin-reclassificar").click();
    await linha.getByLabel("Prioridade nova").selectOption("media");
    await linha.getByTestId("admin-reclassificar-motivo").fill("Porta solta pode cair: média.");
    await linha.getByTestId("admin-reclassificar-salvar").click();
    // Decidido, o pedido sai da fila de reclassificação (a linha some com a mensagem): espera o banco e a fila, não o aviso.
    await expect.poll(async () => (await adm().from("service_orders").select("priority").eq("id", ids.baixa!).single()).data?.priority, { timeout: 20_000 }).toBe("media");
    await a.reload({ waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("solicitacao-linha").filter({ hasText: T.contrato })).toHaveCount(0, { timeout: 20_000 });
    const { data: so } = await adm().from("service_orders").select("priority, prioridade_original, reclassificada_em, reclassificacao_motivo").eq("id", ids.baixa).single();
    expect(so).toMatchObject({ priority: "media", prioridade_original: "baixa", reclassificacao_motivo: "Porta solta pode cair: média." });
    expect(so?.reclassificada_em).toBeTruthy();

    // Fila do topo: "Manutenção fora do prazo".
    await a.goto("/admin/solicitacoes?fora_prazo=1", { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("solicitacao-linha").filter({ hasText: T.contrato })).toContainText("prioridade media", { timeout: 20_000 });
    await a.context().close();

    // A rotina avisa o vencido (fora do silêncio) e o morador vê a hora do aviso ao dono.
    await rodarPrazos(browser, ids.casa!, meioDiaBrasilia());
    const { count } = await adm().from("service_order_eventos").select("id", { count: "exact", head: true }).eq("service_order_id", ids.baixa).eq("tipo", "aviso").eq("status_para", "vencido");
    expect(count).toBe(1);
    const morador = await entrar(browser, inquilino.email, senha);
    await morador.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
    const mo = morador.getByTestId("ordem-manutencao").filter({ hasText: BAIXA });
    await expect(mo.getByTestId("solucao-ordem")).toHaveAttribute("data-estado", "vencido", { timeout: 20_000 });
    await mo.getByTestId("solicitacao-cartao").click();
    await expect(mo.getByTestId("ordem-dono-avisado")).toContainText("O proprietário foi avisado em");
    await semRolagemLateral(morador);
    await morador.context().close();
  });
});
