// Portão pós-#1506/#1507 (Pista C, 29/10): E180 (entrada do anúncio novo, cópia local) e E222-B (renovar = aditivo); roda no lab-crítico deste PR.
import { existsSync, readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/**
 * L-43 (vigia, 24/10): o painel não assenta em "networkidle" (t183, L-40); espera até 10 s e segue para o elemento.
 * Rodada da vigia 24/10 (Pista C): triagem do lab completo de 5f44161, no lab-crítico, sem a carga do lab inteiro.
 * T264 — "Viva rodando automático" (Prompt 38), só no laboratório, 390 e 1280 px, sem diálogo do navegador:
 * 1) o dono vincula a limpeza (automático) e a manutenção (confirmar) em "Parceiros do imóvel"; os parceiros aceitam
 *    em "Imóveis fixos";
 * 2) saída em 4 dias (data simulada pelos blocos) + "Rodar a automação de hoje" → o pedido de limpeza chega ao
 *    parceiro, com a janela e a etiqueta "Automático"; a 2ª rodada não duplica;
 * 6) o morador vê "Precisa de ajuda com a mudança?" (7 dias antes da saída) e recebe o e-mail de sugestão;
 * 7) o parceiro não responde em 24 h → o dono é avisado e troca de parceiro com 1 toque;
 * 4) aditivo +1 mês muda a saída para longe (> 5 dias) → o pedido sem aceite é cancelado com o sufixo ":remarcado:" e
 *    o cron do D-5 da nova saída refaz o pedido com a chave original (E213-B; a prova completa é a t597);
 * 3) conferência de saída com "precisa de reparo" → fecha → o dono confirma → a manutenção chega ao parceiro com o
 *    item e a foto;
 * 5) contrato encerrado → a limpeza automática ainda não aceita é cancelada (a manutenção fica).
 * Admin: filtro "gerado automaticamente" e a contagem por gatilho.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t264.${sufixo}@lab.vivanomads.test`, nome: "Dina Automática", role: "owner" as const };
const morador = { email: `mor.t264.${sufixo}@lab.vivanomads.test`, nome: "Murilo Morador", role: "tenant" as const };
const limpa = { email: `limpa.t264.${sufixo}@lab.vivanomads.test`, nome: "Lara Limpeza", role: "owner" as const };
const limpa2 = { email: `limpa2.t264.${sufixo}@lab.vivanomads.test`, nome: "Lino Limpeza", role: "owner" as const };
const reparo = { email: `reparo.t264.${sufixo}@lab.vivanomads.test`, nome: "Rui Reparos", role: "owner" as const };
const ids: Record<string, string | undefined> = {};

const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
const registro: string[] = [];
function registrar(page: Page, quem: string) {
  const t0 = Date.now();
  const marca = (s: string) => registro.push(`[${quem} +${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  page.on("console", (m) => {
    if (m.type() === "error") marca(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => marca(`pageerror: ${e.message}`));
  page.on("requestfinished", async (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    marca(`ação ← ${(await r.response())?.status()} ${r.url()}`);
  });
}
async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  registrar(page, email.split(".")[0]);
  return page;
}
async function abrirAdmin(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage();
  semDialogo(a);
  registrar(a, "admin");
  return a;
}
async function rodarAutomacao(browser: Browser) {
  const a = await abrirAdmin(browser);
  await a.goto("/admin/parceiros/pedidos", { waitUntil: "domcontentloaded" });
  await a.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await a.getByTestId("rodar-automacao").click();
  await expect(a.getByTestId("rodar-automacao-resultado")).toContainText("Feito:", { timeout: 60_000 });
  await a.context().close();
}
async function parceiro(userId: string, nome: string, slug: string, categoria: string): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug, categorias: [categoria], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  await adm().from("parceiro_servicos").insert({ parceiro_id: data.id, categoria, titulo: `${categoria === "limpeza" ? "Limpeza" : "Reparos"} completo`, preco_base: 250, unidade: "por serviço", ativo: true });
  return data.id as string;
}
const BASE_LIMPEZA = () => `${ids.imovel}:limpeza:${ids.contrato}:saida`;
async function pedidosDaChave() {
  const { data } = await adm().from("parceiro_pedidos").select("id, parceiro_id, status, janela_inicio, janela_fim, chave_automacao, aguardando_dono, origem, gatilho").like("chave_automacao", `${BASE_LIMPEZA()}%`).order("criado_em");
  return (data ?? []) as { id: string; parceiro_id: string; status: string; janela_inicio: string; janela_fim: string; chave_automacao: string; aguardando_dono: boolean; origem: string; gatilho: string }[];
}
async function emailPara(email: string, assunto: RegExp, depoisDe: number): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const novos = (await lerSaida()).slice(depoisDe);
    if (novos.some((e) => e.servico === "email" && e.para === email && assunto.test(String(e.assunto ?? "")))) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").gt("criado_em", depoisDe).order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código do aditivo não chegou à caixa de testes em 30 s.");
}

test.describe("T264 — Viva rodando automático (Prompt 38)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "Sem a conta admin de teste: a automação do dia é rodada pelo admin.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.limpa = await criarConta(limpa, senha);
    ids.limpa2 = await criarConta(limpa2, senha);
    ids.reparo = await criarConta(reparo, senha);
    // Dono e morador de teste: o código do aditivo cai na caixa de e-mails de teste.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    ids.pLimpa = await parceiro(ids.limpa, `Lara Limpa ${sufixo}`, `lara-t264-${sufixo}`, "limpeza");
    ids.pLimpa2 = await parceiro(ids.limpa2, `Lino Limpa ${sufixo}`, `lino-t264-${sufixo}`, "limpeza");
    ids.pReparo = await parceiro(ids.reparo, `Rui Reparos ${sufixo}`, `rui-t264-${sufixo}`, "manutencao");
    ids.imovel = await criarImovelPronto(ids.dono, `Studio automático ${sufixo}`, { ativo: true, preco: 3000 });
    await adm().from("properties").update({ checkout_before: "11:00", checkin_after: "14:00" }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora, status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    // Saída daqui a 4 dias (dentro dos 5 dias da limpeza e dos 7 da sugestão ao morador).
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-56), fim: dia(4), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    if (eb) throw eb;
  });

  test.beforeEach(() => {
    registro.length = 0;
  });
  test.afterEach(async ({}, info) => {
    if (info.status === info.expectedStatus) return;
    console.log(`── diagnóstico de "${info.title}" ──\n${registro.join("\n")}`);
    const log = `${SAIDA}/servidor.log`;
    if (existsSync(log)) console.log(`── servidor.log (fim) ──\n${readFileSync(log, "utf8").split("\n").slice(-120).join("\n")}`);
  });

  test.afterAll(async () => {
    const parceiros = [ids.pLimpa, ids.pLimpa2, ids.pReparo].filter(Boolean) as string[];
    if (ids.contrato) await adm().from("parceiro_pedidos").delete().eq("contrato_id", ids.contrato);
    if (ids.imovel) await adm().from("imovel_parceiros").delete().eq("property_id", ids.imovel);
    await adm().from("parceiros").delete().in("id", parceiros);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador, ids.limpa, ids.limpa2, ids.reparo]);
  });

  test("1. dono vincula limpeza (automático) e manutenção (confirmar); os parceiros aceitam", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("parceiros-imovel-link").first()).toBeVisible();
    await d.goto(`/dashboard/imoveis/${ids.imovel}/parceiros`, { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(d.getByTestId("parceiros-do-imovel")).toBeVisible();
    // Limpeza: Lara, automático, com instruções.
    const cl = d.getByTestId("convidar-limpeza");
    await cl.getByTestId("parceiro-limpeza").selectOption(ids.pLimpa!);
    await expect(cl.getByTestId("servico-limpeza")).toContainText("a partir de R$");
    await cl.getByTestId("modo-automatico-limpeza").click();
    await cl.getByTestId("instrucoes-limpeza").fill("Trocar o enxoval; chave na portaria.");
    await cl.getByTestId("convidar-limpeza-enviar").click();
    await expect(d.getByTestId("vinculo-limpeza")).toHaveAttribute("data-status", "pendente", { timeout: 20_000 });
    // Manutenção: Rui, sempre "confirmar".
    const cm = d.getByTestId("convidar-manutencao");
    await cm.getByTestId("parceiro-manutencao").selectOption(ids.pReparo!);
    await expect(cm).toContainText("Modo: pedir minha confirmação");
    await cm.getByTestId("convidar-manutencao-enviar").click();
    await expect(d.getByTestId("vinculo-manutencao")).toHaveAttribute("data-status", "pendente", { timeout: 20_000 });
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t264-parceiros-do-imovel-1280.png`, fullPage: true });
    await d.setViewportSize({ width: 390, height: 844 });
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t264-parceiros-do-imovel-390.png`, fullPage: true });
    const { data: v } = await adm().from("imovel_parceiros").select("categoria, modo, status, instrucoes").eq("property_id", ids.imovel!).order("categoria");
    expect(v).toEqual([
      { categoria: "limpeza", modo: "automatico", status: "pendente", instrucoes: "Trocar o enxoval; chave na portaria." },
      { categoria: "manutencao", modo: "confirmar", status: "pendente", instrucoes: null },
    ]);
    await d.context().close();

    for (const [email, largura] of [[limpa.email, 390], [reparo.email, 1280]] as const) {
      const p = await abrir(browser, email, largura);
      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const item = p.getByTestId("imoveis-fixos").getByTestId("imovel-fixo");
      await expect(item).toHaveAttribute("data-status", "pendente");
      await expect(item).toContainText("Centro, Uberlândia");
      await item.getByTestId("aceitar-convite-fixo").click();
      await expect(item).toHaveAttribute("data-status", "ativo", { timeout: 20_000 });
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t264-imoveis-fixos-${largura}.png`, fullPage: true });
      await p.context().close();
    }
  });

  test("2. saída em 4 dias → a limpeza chega ao parceiro com a janela; a 2ª rodada não duplica", async ({ browser }) => {
    test.setTimeout(150_000);
    const antes = (await lerSaida()).length;
    await rodarAutomacao(browser);
    let pedidos = await pedidosDaChave();
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ parceiro_id: ids.pLimpa, status: "solicitado", aguardando_dono: false, origem: "automatico", gatilho: "saida_limpeza" });
    // Janela: saída (11:00 de Brasília) + 2 h até + 48 h.
    expect(new Date(pedidos[0].janela_inicio).toISOString()).toBe(new Date(`${dia(4)}T13:00:00-03:00`).toISOString());
    expect(new Date(pedidos[0].janela_fim).toISOString()).toBe(new Date(`${dia(6)}T11:00:00-03:00`).toISOString());
    expect(await emailPara(limpa.email, /Novo pedido de orçamento/, antes)).toBe(true);

    await rodarAutomacao(browser);
    pedidos = await pedidosDaChave();
    expect(pedidos, "idempotência: o mesmo disparo não cria outro pedido").toHaveLength(1);

    for (const largura of [390, 1280]) {
      const p = await abrir(browser, limpa.email, largura);
      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const linha = p.getByTestId("parceiro-pedido").filter({ has: p.getByTestId("pedido-automatico") });
      await expect(linha).toHaveCount(1);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t264-parceiro-pedidos-${largura}.png`, fullPage: true });
      await linha.click();
      await expect(p.getByTestId("pedido-automatico-info")).toContainText("Pedido automático");
      await expect(p.getByTestId("pedido-parceiro")).toContainText("Limpeza depois da saída do morador: entre");
      await expect(p.getByTestId("pedido-parceiro")).toContainText("Instruções do proprietário: Trocar o enxoval; chave na portaria.");
      await expect(p.getByTestId("pedido-parceiro")).toContainText("Serviço: Limpeza completo (a partir de R$");
      await expect(p.getByTestId("pedido-endereco")).toHaveCount(0);
      await semRolagemLateral(p);
      await p.context().close();
    }

    // Admin: filtro e contagem por gatilho (contas de teste fora da contagem; a lista mostra tudo).
    const a = await abrirAdmin(browser);
    await a.goto("/admin/parceiros/pedidos", { waitUntil: "domcontentloaded" });
    await a.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(a.getByTestId("admin-gatilho-saida_limpeza")).toBeVisible();
    await a.getByTestId("admin-filtro-automaticos").click();
    await expect(a).toHaveURL(/origem=automatico/);
    await expect(a.getByTestId("admin-pedidos-lista")).toContainText("Limpeza na saída");
    await expect(a.getByTestId("admin-pedidos-lista").getByText("origem manual")).toHaveCount(0);
    await a.screenshot({ path: `${SAIDA}/t264-admin-pedidos-1280.png`, fullPage: true });
    await a.context().close();
  });

  test("6. morador vê a sugestão de mudança 7 dias antes da saída (só sugestão)", async ({ browser }) => {
    test.setTimeout(90_000);
    const { data: env } = await adm().from("automacoes_envios").select("chave").eq("usuario_id", ids.morador!).like("chave", "sugestao_parceiros_morador:%");
    expect(env).toHaveLength(1);
    for (const largura of [390, 1280]) {
      const m = await abrir(browser, morador.email, largura);
      await m.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const cartao = m.getByTestId("estadia-ajuda-mudanca");
      await expect(cartao).toHaveAttribute("data-momento", "saida");
      await expect(cartao).toContainText("nada é contratado sem você");
      await expect(m.getByTestId("estadia-depois-da-saida")).toHaveCount(0);
      await semRolagemLateral(m);
      await cartao.screenshot({ path: `${SAIDA}/t264-ajuda-mudanca-${largura}.png` });
      await m.context().close();
    }
    const { count } = await adm().from("parceiro_pedidos").select("id", { count: "exact", head: true }).eq("cliente_id", ids.morador!);
    expect(count, "nunca pedido em nome do morador").toBe(0);
  });

  test("7. parceiro sem resposta em 24 h → dono avisado → troca de parceiro com 1 toque", async ({ browser }) => {
    test.setTimeout(150_000);
    const [p0] = await pedidosDaChave();
    await adm().from("parceiro_pedidos").update({ enviado_em: new Date(Date.now() - 25 * 3_600_000).toISOString() }).eq("id", p0.id);
    const antes = (await lerSaida()).length;
    await rodarAutomacao(browser);
    expect(await emailPara(dono.email, /O parceiro ainda não respondeu/, antes)).toBe(true);
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const cartao = d.getByTestId("estadia-depois-da-saida");
    await expect(cartao).toContainText("Sem resposta do parceiro em 24 horas");
    await semRolagemLateral(d);
    await cartao.screenshot({ path: `${SAIDA}/t264-depois-da-saida-1280.png` });
    // A resposta da própria ação entra na mensagem de erro (o banco é conferido antes da tela).
    const resposta = d.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"], { timeout: 30_000 });
    await cartao.getByTestId("depois-da-saida-trocar").click();
    const corpo = await resposta.then((r) => r.text()).catch((e) => `sem resposta: ${String(e)}`);
    let pedidos = await pedidosDaChave();
    for (let i = 0; i < 20 && pedidos.find((p) => p.id === p0.id)?.status !== "cancelado"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      pedidos = await pedidosDaChave();
    }
    const antigo = pedidos.find((p) => p.id === p0.id)!;
    const alerta = await cartao.getByRole("alert").allTextContents();
    expect(antigo.status, `ação: ${corpo.slice(-800)} · alerta: ${alerta.join(" | ")}`).toBe("cancelado");
    await d.reload({ waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(cartao).not.toContainText("Sem resposta do parceiro");
    expect(antigo.chave_automacao).toMatch(/:troca:\d+$/);
    const atual = pedidos.filter((p) => p.chave_automacao === BASE_LIMPEZA());
    expect(atual).toHaveLength(1);
    expect(atual[0].parceiro_id).not.toBe(ids.pLimpa);
    expect(atual[0].status).toBe("solicitado");
    await d.context().close();
  });

  test("4. aditivo +1 mês leva a saída para longe → cancelado com o sufixo; o cron do D-5 refaz com a chave original", async ({ browser }) => {
    test.setTimeout(240_000);
    const [antes] = (await pedidosDaChave()).filter((p) => p.chave_automacao === BASE_LIMPEZA());
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}/alteracao`, { waitUntil: "domcontentloaded" });
    await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await m.getByTestId("alteracao-meses").selectOption("3");
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await d.getByTestId("aditivo-aceitar").click();
    await expect(d.getByTestId("estadia-aditivo")).toHaveAttribute("data-status", "aceito", { timeout: 30_000 });
    for (const [pagina, quem] of [[d, ids.dono!], [m, ids.morador!]] as const) {
      await pagina.reload({ waitUntil: "domcontentloaded" });
      await pagina.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const desde = new Date().toISOString();
      await pagina.getByTestId("aditivo-pedir-codigo").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
      await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
      await pagina.getByTestId("aditivo-aceite").check();
      await pagina.getByTestId("aditivo-assinar").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
    }
    // E213-B: sem aceite e a nova saída a mais de 5 dias → cancelado; a chave dele ganha o sufixo e fica livre.
    const depois = await pedidosDaChave();
    const velho = depois.find((p) => p.id === antes.id)!;
    expect(velho.status).toBe("cancelado");
    expect(velho.chave_automacao).toMatch(/:remarcado:\d+$/);
    expect(depois.filter((p) => p.chave_automacao === BASE_LIMPEZA()), "nenhum pedido na chave original até o D-5").toHaveLength(0);
    await d.context().close();
    await m.context().close();
    // A data simulada: a nova saída chega a 4 dias → o cron do D-5 refaz o pedido com a chave original. Depois, as
    // datas voltam (a conferência e o encerramento seguem com a estadia renovada).
    const { data: blocos } = await adm().from("contrato_blocos").select("id, numero_bloco, inicio, fim").eq("contrato_id", ids.contrato!).order("numero_bloco");
    const [b1, b2] = blocos as { id: string; numero_bloco: number; inicio: string; fim: string }[];
    await adm().from("contrato_blocos").update({ fim: dia(-27) }).eq("id", b1.id);
    await adm().from("contrato_blocos").update({ inicio: dia(-26), fim: dia(4) }).eq("id", b2.id);
    await rodarAutomacao(browser);
    await adm().from("contrato_blocos").update({ inicio: b2.inicio, fim: b2.fim }).eq("id", b2.id);
    await adm().from("contrato_blocos").update({ fim: b1.fim }).eq("id", b1.id);
    const refeito = (await pedidosDaChave()).filter((p) => p.chave_automacao === BASE_LIMPEZA());
    expect(refeito, "o cron refaz um pedido, com a chave original").toHaveLength(1);
    expect(refeito[0].status).toBe("solicitado");
  });

  test("3. conferência de saída com 'precisa de reparo' → dono confirma → a manutenção chega ao parceiro com o item e a foto", async ({ browser }) => {
    test.setTimeout(240_000);
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const formD = d.getByTestId("conferencia-saida-form");
    await formD.getByLabel("Cômodo", { exact: true }).fill("Banheiro");
    await formD.getByLabel("Itens e estado do cômodo").fill("Torneira pingando");
    await formD.getByLabel("Foto do cômodo").setInputFiles({ name: "torneira.png", mimeType: "image/png", buffer: pngDeTeste(5) });
    await formD.getByTestId("conferencia-saida-reparo").check();
    await formD.getByRole("button", { name: "Adicionar item" }).click();
    await expect(d.getByTestId("conferencia-saida-itens").getByTestId("item-precisa-reparo")).toHaveCount(1, { timeout: 30_000 });

    const m = await abrir(browser, morador.email);
    await m.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("conferencia-saida-reparo"), "só o dono marca reparo").toHaveCount(0);
    const formM = m.getByTestId("conferencia-saida-form");
    await formM.getByLabel("Cômodo", { exact: true }).fill("Sala");
    await formM.getByLabel("Itens e estado do cômodo").fill("Sofá limpo, sem manchas");
    await formM.getByRole("button", { name: "Adicionar item" }).click();
    await expect(m.getByTestId("conferencia-saida-itens")).toContainText("Sofá limpo", { timeout: 30_000 });
    await m.getByTestId("conferencia-saida-confirmar").click();
    await expect(m.getByTestId("conferencia-saida-respostas")).toContainText("confirmou", { timeout: 30_000 });

    await d.reload({ waitUntil: "domcontentloaded" });
    await d.getByTestId("conferencia-saida-confirmar").click();
    await expect(d.getByTestId("conferencia-saida-respostas")).toContainText("confirmou", { timeout: 30_000 });

    // A conferência fecha depois da resposta (after) e o fechamento gera o pedido de manutenção, esperando o dono.
    let pedido: { id: string; aguardando_dono: boolean; descricao: string } | null = null;
    for (let i = 0; i < 30 && !pedido; i++) {
      const { data } = await adm().from("parceiro_pedidos").select("id, aguardando_dono, descricao").eq("contrato_id", ids.contrato!).eq("gatilho", "reparo_manutencao").maybeSingle();
      pedido = data as typeof pedido;
      if (!pedido) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(pedido, "a conferência fechada gera a manutenção").not.toBeNull();
    expect(pedido!.aguardando_dono).toBe(true);
    expect(pedido!.descricao).toContain("Reparos apontados na conferência de saída:\n- Banheiro: Torneira pingando (1 foto)");

    // O parceiro ainda não vê; o dono confirma pelo cartão "Depois da saída".
    const r = await abrir(browser, reparo.email);
    await r.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await r.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(r.getByTestId("parceiro-pedido")).toHaveCount(0);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const cartao = d.getByTestId("estadia-depois-da-saida");
    await expect(cartao).toContainText("Reparo depois da conferência");
    await expect(cartao).toContainText("Espera a sua confirmação");
    await d.setViewportSize({ width: 390, height: 844 });
    await semRolagemLateral(d);
    await cartao.screenshot({ path: `${SAIDA}/t264-depois-da-saida-390.png` });
    await cartao.getByTestId("depois-da-saida-confirmar").click();
    await expect(cartao).not.toContainText("Espera a sua confirmação", { timeout: 30_000 });

    await r.reload({ waitUntil: "domcontentloaded" });
    await r.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await r.getByTestId("parceiro-pedido").first().click();
    await expect(r.getByTestId("pedido-parceiro")).toContainText("Banheiro: Torneira pingando (1 foto)");
    await expect(r.getByTestId("pedido-mensagens")).toContainText("Torneira pingando");
    // A marca entra no pacote de provas da conferência.
    await d.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("conferencia-saida-itens").getByTestId("item-precisa-reparo")).toHaveCount(1);
    await d.context().close();
    await m.context().close();
    await r.context().close();
  });

  test("5. contrato encerrado → a limpeza automática não aceita é cancelada; a manutenção fica", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email);
    await m.goto(`/dashboard/estadia/${ids.contrato}/encerrar`, { waitUntil: "domcontentloaded" });
    await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await m.getByTestId("encerrar-motivo-mudanca_planos_morador").check();
    await m.getByTestId("encerrar-continuar").click();
    await m.getByTestId("encerrar-confirmar").click();
    await m.getByTestId("encerrar-confirmar-confirmar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    await m.context().close();

    const a = await abrirAdmin(browser);
    await a.goto("/admin/contratos/encerramentos", { waitUntil: "domcontentloaded" });
    await a.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const card = a.locator(`[data-testid="admin-encerramento"][data-contrato="${ids.contrato}"]`);
    await card.getByTestId("encerramento-concluir").click();
    await card.getByTestId("encerramento-concluir-confirmar").click();
    let status = "";
    for (let i = 0; i < 30 && status !== "cancelado"; i++) {
      const atual = (await pedidosDaChave()).find((p) => p.chave_automacao === BASE_LIMPEZA());
      status = atual?.status ?? "";
      if (status !== "cancelado") await new Promise((r) => setTimeout(r, 1000));
    }
    expect(status).toBe("cancelado");
    const { data: man } = await adm().from("parceiro_pedidos").select("status").eq("contrato_id", ids.contrato!).eq("gatilho", "reparo_manutencao").single();
    expect(man!.status, "o reparo é do imóvel: continua").toBe("solicitado");
    await a.context().close();
  });
});
