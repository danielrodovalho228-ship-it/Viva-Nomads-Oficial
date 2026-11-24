import { test, expect, type Browser, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { account, hasAccount } from "../fixtures/accounts";
import { authFile } from "../fixtures/auth";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  confirmarContatoDaConta,
  criarConta,
  criarImovelPronto,
  entrar,
  gravarMensagem,
  liberarLimitePedidos,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";
import { encerrarPedido, marcadorPedido, preencherPedido, publicarPreenchido } from "../fixtures/pedido";
import { defeitoConhecido } from "../fixtures/defeito-conhecido";

/**
 * T-TRAV — TRAVESSIAS DE PONTA A PONTA (@criticos)
 *
 * As jornadas onde a REGRA DE OURO tem que valer: a plataforma nunca move
 * dinheiro e o contato só é liberado após aceite mútuo. Cada bloco isola uma
 * travessia e limpa o que criou (teardown idempotente).
 *
 * B — Pedido de moradia: identidade do inquilino NÃO vaza antes do aceite.
 * C — Candidatura sem verificação: confirmação + nudge (nunca bloqueio).
 * D — Fechamento fracionado: blocos, caução 50% e comissão única.
 * F — Chat: telefone/e-mail/@rede social mascarados.
 *
 * Caça ao esqueleto (A3, ORDEM-DUET-695): C, D e F pulavam SEMPRE no laboratório — o imóvel semeado
 * (TESTES_SEED_PROPERTY_ID) só existe na massa de preview, o inquilino fixo não tinha conversa, e o roteiro era o de
 * antes do diálogo de candidatura (E518). Agora correm no laboratório no fluxo actual, cada bloco com a massa dele
 * (contas, imóvel, conversa); sem massa não há pulo, há falha com nome.
 *
 * Notas de automação (limites reais da arquitetura):
 *  · Não existe API GET/JSON de pedidos no browser — os dados chegam por Server
 *    Action + VIEW `pedidos_publicos` (mascaramento no Postgres). Por isso a
 *    asserção de B é feita no FIO (todos os response bodies, incl. payload RSC):
 *    o conteúdo do pedido aparece, a identidade (e-mail/sobrenome) não.
 *  · D: o Fechamento abre pela candidatura aceita (`?c=<lead>`); o imóvel do teste não tem condomínio, contas nem
 *    limpezas, por isso o total do período é só o aluguel: 4 × R$ 3.200 = R$ 12.800, em 2 blocos de 2 meses.
 */

/** Marca única por execução (só letras: dígitos demais parecem telefone). */
const marca = marcadorPedido;

/** Última palavra do nome = sobrenome (o que NÃO pode vazar antes do aceite). */
function sobrenome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

// ───────────────────────────── B — Identidade protegida ─────────────────────
test.describe("T-TRAV-B — Pedido: identidade não vaza antes do aceite @criticos", () => {
  // Laboratório: o pedido só chega ao dono com e-mail e telefone da conta confirmados (0160) e a conta fixa do
  // inquilino tem limite de 3 pedidos por dia; sem isto o mural vem vazio e o último pedido do dia é recusado.
  test.beforeAll(async () => {
    if (!NO_LABORATORIO || !hasAccount("inquilino")) return;
    await confirmarContatoDaConta(account("inquilino").email);
    await liberarLimitePedidos();
  });

  /** Cria um pedido de moradia (Uberlândia/MG, para casar com o imóvel semeado). */
  async function publicarPedido(page: Page, tag: string): Promise<void> {
    // Apresentação carrega a marca — deve APARECER para o dono (conteúdo flui).
    await preencherPedido(page, { apresentacao: `Perfil de ${tag}. Procuro imovel mobiliado de media duracao.` });
    await publicarPreenchido(page);
  }

  /**
   * Encerra SÓ o pedido deste teste (pela marca). Antes marcava todos os
   * pedidos da conta — e o T5, que usa o mesmo inquilino em paralelo, perdia o
   * dele no meio do teste.
   */
  async function limparPedidos(browser: Browser, tag: string): Promise<void> {
    const ctx = await browser.newContext({ storageState: authFile("inquilino") });
    const page = await ctx.newPage();
    await encerrarPedido(page, tag).catch(() => {});
    await ctx.close();
  }

  test("o dono vê o pedido, mas nunca o e-mail/sobrenome do inquilino", async ({ browser }) => {
    defeitoConhecido("E975", "o sobrenome de exemplo \"Lima\" viaja no JavaScript do painel de contas reais e derruba a guarda do fio");
    test.setTimeout(90_000); // publica, abre o mural do dono e limpa: 3 sessões
    const inq = account("inquilino");
    const tag = marca();

    // (1) Inquilino publica o pedido.
    const ctxInq = await browser.newContext({ storageState: authFile("inquilino") });
    const pageInq = await ctxInq.newPage();
    try {
      await publicarPedido(pageInq, tag);
    } catch (e) {
      await ctxInq.close();
      // No laboratório isto é teste de SEGURANÇA e tem de rodar: falhar a
      // pré-condição é falha, não pulo. Fora dele (preview), segue pulando.
      if (process.env.INTEGRACOES_SIMULADAS === "on") throw e;
      test.skip(true, `Não foi possível publicar o pedido (pré-condição): ${String(e)}`);
      return;
    }
    await ctxInq.close();

    // (2) Proprietário abre a lista da cidade; capturamos TODOS os corpos de
    // resposta (HTML + payload RSC) para provar que a identidade não trafega.
    const ctxDono = await browser.newContext({ storageState: authFile("proprietario") });
    const pageDono = await ctxDono.newPage();
    const corpos: string[] = [];
    pageDono.on("response", async (res) => {
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (/text|json|javascript/.test(ct)) corpos.push(await res.text());
      } catch {
        /* respostas sem corpo (redirects/2xx vazios) — ignora */
      }
    });

    await pageDono.goto("/dashboard/pedidos-cidade", { waitUntil: "networkidle" });
    await expect(pageDono.getByRole("heading", { name: /Pedidos de moradia/i })).toBeVisible();
    // Deixa o RSC/streaming assentar antes de inspecionar o fio.
    await pageDono.waitForTimeout(1500);

    const fio = corpos.join("\n");
    const sn = sobrenome(inq.nome);

    // O conteúdo do pedido CHEGA ao dono (senão a ausência abaixo não prova nada).
    expect(fio, "o pedido de teste não chegou ao dono").toContain(tag);

    // A REGRA DE OURO: e-mail e sobrenome do inquilino não podem trafegar.
    expect(fio, "e-mail do inquilino vazou no fio pré-aceite").not.toContain(inq.email);
    if (sn) {
      expect(fio, "sobrenome do inquilino vazou no fio pré-aceite").not.toContain(sn);
    }

    await ctxDono.close();
    await limparPedidos(browser, tag);
  });

  // Sem afterAll aqui: uma varredura por marca pegaria o pedido do T5 rodando
  // em paralelo. Sobras ficam para o global-teardown (fim de toda a suíte).
});

// ─────────────── Massa própria de C, D e F (laboratório) ───────────────
const senha = novaSenha();

type Massa = { sufixo: string; dono: { email: string; nome: string }; inq: { email: string; nome: string }; ids: { dono?: string; inq?: string; imovel?: string } };

function novaMassa(bloco: string): Massa {
  const sufixo = novoSufixo();
  return {
    sufixo,
    dono: { email: `dono.t11${bloco}.${sufixo}@lab.vivanomads.test`, nome: "Paulo Travessia" },
    inq: { email: `inq.t11${bloco}.${sufixo}@lab.vivanomads.test`, nome: "Ana Travessia" },
    ids: {},
  };
}

/** Contas e imóvel do bloco: R$ 3.200/mês, sem condomínio, contas nem limpezas (o total do período é só o aluguel). */
async function montarMassa(m: Massa, titulo: string): Promise<void> {
  m.ids.dono = await criarConta({ ...m.dono, role: "owner" }, senha);
  m.ids.inq = await criarConta({ ...m.inq, role: "tenant" }, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [m.ids.dono, m.ids.inq]);
  m.ids.imovel = await criarImovelPronto(m.ids.dono, `${titulo} ${m.sufixo}`, { ativo: true, preco: 3200 });
  const { error } = await adm()
    .from("properties")
    .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 0, prep_fee: 0, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
    .eq("id", m.ids.imovel);
  if (error) throw error;
}

async function desmontarMassa(m: Massa): Promise<void> {
  if (m.ids.imovel) await adm().from("messages").delete().eq("property_id", m.ids.imovel);
  if (m.ids.dono) await adm().from("leads").delete().eq("owner_id", m.ids.dono);
  await adm().from("emails_teste").delete().in("usuario_id", [m.ids.dono, m.ids.inq].filter(Boolean) as string[]);
  await apagarContas([m.ids.inq, m.ids.dono]);
}

const hoje = new Date();
const emDias = (n: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n)).toISOString().slice(0, 10);
const ENTRADA = emDias(40);
const SAIDA = emDias(160); // 120 dias = 4 meses → 2 blocos de 2 meses

/** A moradora pede para morar pelo diálogo de hoje (datas no cartão → Continuar → Continuar → Enviar candidatura). */
async function pedirParaMorar(browser: Browser, m: Massa): Promise<Page> {
  const page = await entrar(browser, m.inq.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/imoveis/${m.ids.imovel}`, { waitUntil: "domcontentloaded" });
  const card = page.locator("#cartao-preco");
  await card.getByTestId("candidatura-inicio").fill(ENTRADA);
  await card.getByTestId("candidatura-saida").fill(SAIDA);
  const passo = page.getByTestId("solicitacao-passo");
  await expect(async () => {
    await card.getByRole("button", { name: "Pedir para morar", exact: true }).click();
    await expect(passo).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(page.getByTestId("candidatura-confirmada"), "a candidatura foi enviada").toContainText("Candidatura enviada", { timeout: 20_000 });
  return page;
}

async function leadDe(m: Massa): Promise<{ id: string; status: string }> {
  const { data, error } = await adm().from("leads").select("id, status").eq("property_id", m.ids.imovel!).eq("tenant_id", m.ids.inq!).single();
  if (error) throw error;
  return data as { id: string; status: string };
}

// ──────────────────── C — Candidatura sem verificação: nudge ─────────────────
test.describe("T-TRAV-C — Candidatura sem verificação = confirmação + nudge @criticos", () => {
  test.skip(!NO_LABORATORIO, "Massa própria: só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const m = novaMassa("c");
  test.beforeAll(async () => montarMassa(m, "Studio da travessia C"));
  test.afterAll(async () => desmontarMassa(m));

  test("candidatar-se confirma e convida a verificar — nunca bloqueia", async ({ browser }) => {
    const page = await pedirParaMorar(browser, m);
    const janela = page.getByTestId("candidatura-confirmada");
    // Confirmação (nunca "fechamento"/bloqueio), com o caminho para Mensagens.
    await expect(janela.getByRole("link", { name: /Acompanhar em Mensagens/i })).toBeVisible();
    await expect(janela).not.toContainText(/bloquead|imped|não pode|precisa verificar antes/i);
    expect((await leadDe(m)).status, "a candidatura ficou gravada, à espera do dono").toBe("new");

    // Fechada a janela, o cartão do imóvel fica com a confirmação e o convite do perfil — convite, não porta.
    await janela.getByRole("button", { name: "Fechar" }).click();
    const card = page.locator("#cartao-preco");
    await expect(card.getByText("Candidatura enviada")).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole("link", { name: /Complete seu perfil/i })).toBeVisible();
    // Sem promessa de "em breve" (Prompt 35A, item 3) — lida depois do positivo acima, nunca no esqueleto.
    await expect(page.getByText(/Verificação de identidade: em breve/i)).toHaveCount(0);
    await expect(card).not.toContainText(/bloquead|imped|não pode|precisa verificar antes/i);
    await page.context().close();
  });

  test("acompanhamento em /dashboard/candidaturas usa vocabulário digno (nunca 'recusada')", async ({ browser }) => {
    const page = await entrar(browser, m.inq.email, senha);
    await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Minhas candidaturas/i })).toBeVisible({ timeout: 30_000 });
    // A candidatura do caso anterior está na lista (senão a ausência abaixo não prova nada).
    await expect(page.locator("main").getByText(`Studio da travessia C ${m.sufixo}`).first()).toBeVisible({ timeout: 20_000 });
    // A página sobrevive ao reload (estado no servidor, não no cliente).
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByText(`Studio da travessia C ${m.sufixo}`).first()).toBeVisible({ timeout: 20_000 });
    // NUNCA jargão de recusa na tela do inquilino.
    await expect(page.locator("body")).not.toContainText(/recusad|rejeitad/i);
    await page.context().close();
  });
});

// ─────────────────── D — Fechamento herda a candidatura aceita ───────────────
test.describe("T-TRAV-D — Fechamento herda a candidatura aceita real @criticos", () => {
  test.skip(!NO_LABORATORIO, "Massa própria: só no laboratório.");
  test.describe.configure({ timeout: 180_000 });
  const m = novaMassa("d");
  test.beforeAll(async () => montarMassa(m, "Studio da travessia D"));
  test.afterAll(async () => desmontarMassa(m));

  test("candidatura aceita → fechamento com o imóvel real, 2 blocos e R$ 12.800", async ({ browser }) => {
    // (1) A moradora pede para morar (R$ 3.200/mês, 120 dias).
    const pageInq = await pedirParaMorar(browser, m);
    await pageInq.context().close();
    const lead = await leadDe(m);

    // (2) O dono aprova pela tela das candidaturas.
    const pageDono = await entrar(browser, m.dono.email, senha);
    await pageDono.setViewportSize({ width: 1280, height: 900 });
    await pageDono.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    const aprovar = pageDono.getByTestId("aprovar-candidatura").first();
    await expect(aprovar, "a candidatura chegou ao dono").toBeVisible({ timeout: 30_000 });
    await aprovar.click();
    await expect.poll(async () => (await leadDe(m)).status, { message: "o aceite ficou gravado", timeout: 20_000 }).toBe("accepted");

    // (3) O Fechamento herda a candidatura: o imóvel real, 4 meses (120 dias) em 2 blocos e R$ 12.800 no período.
    await pageDono.goto(`/dashboard/fechamento?c=${lead.id}`, { waitUntil: "domcontentloaded" });
    await expect(pageDono.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
    // Nunca a guarda "sem candidatura" — lida depois do positivo acima.
    await expect(pageDono.getByText(/Nenhuma candidatura aceita/i)).toHaveCount(0);
    await expect(pageDono.locator("main")).toContainText(`Studio da travessia D ${m.sufixo}`);
    const preco = pageDono.getByTestId("fechamento-preco");
    await expect(preco.locator("xpath=..")).toContainText(/^\s*2 blocos ·/);
    await expect(preco).toContainText(/total do per[íi]odo/i);
    // Valor exato herdado do imóvel (3.200 × 4), sem nada somado.
    await expect(pageDono.getByTestId("fechamento-total-periodo")).toHaveAttribute("data-total", "12800");
    await expect(pageDono.getByTestId("fechamento-total-periodo")).toContainText("12.800");
    await pageDono.context().close();
  });
});

// ─────────────────────── F — Chat: contato mascarado ─────────────────────────
test.describe("T-TRAV-F — Chat mascara telefone, e-mail e @rede social @criticos", () => {
  test.skip(!NO_LABORATORIO, "Massa própria: só no laboratório.");
  test.describe.configure({ timeout: 120_000 });
  const MASK = "[contato protegido]";
  const m = novaMassa("f");
  test.beforeAll(async () => {
    await montarMassa(m, "Studio da travessia F");
    await gravarMensagem(m.ids.dono!, m.ids.inq!, m.ids.imovel!, "Olá! Pode perguntar por aqui.", conversationId(m.ids.inq!, m.ids.dono!, m.ids.imovel!));
  });
  test.afterAll(async () => desmontarMassa(m));

  test("os 3 padrões viram '[contato protegido]' no envio", async ({ browser }) => {
    const page = await entrar(browser, m.inq.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    const conversa = page.getByRole("button", { name: new RegExp(`Studio da travessia F ${m.sufixo}`) }).first();
    await expect(conversa, "a conversa do teste está na lista").toBeVisible({ timeout: 30_000 });
    await conversa.click();
    const campo = page.getByTestId("mensagem-campo");
    await expect(campo).toBeVisible();

    const texto = `liga (34) 99999-0001, e-mail joao@teste.com ou me segue @joao.nomad ${m.sufixo}`;
    await campo.fill(texto);
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    // E445 item 2: primeiro o aviso com a prévia mascarada; o envio só sai no "Enviar mesmo assim".
    await expect(page.getByTestId("aviso-previa")).toContainText(MASK);
    await expect(page.getByTestId("aviso-antes-de-enviar")).toContainText(/telefones, e-mails e links externos são protegidos/i);
    await page.getByRole("button", { name: "Enviar mesmo assim" }).click();

    // O eco já vem mascarado (a mesma função do servidor) e nada do contato fica na tela.
    await expect(page.getByText(MASK).last()).toBeVisible({ timeout: 10_000 });
    const corpo = page.locator("body");
    await expect(corpo).not.toContainText("99999-0001");
    await expect(corpo).not.toContainText("joao@teste.com");
    await expect(corpo).not.toContainText("@joao.nomad");
    // E o que ficou gravado também: os três padrões mascarados.
    await expect
      .poll(async () => {
        const { data } = await adm().from("messages").select("body").eq("sender_id", m.ids.inq!).eq("property_id", m.ids.imovel!);
        return (data ?? []).map((r) => String(r.body)).find((b) => b.includes(m.sufixo)) ?? "";
      }, { message: "a mensagem gravada", timeout: 20_000 })
      .toMatch(/\[contato protegido\]/);
    const { data } = await adm().from("messages").select("body").eq("sender_id", m.ids.inq!).eq("property_id", m.ids.imovel!);
    const gravada = (data ?? []).map((r) => String(r.body)).find((b) => b.includes(m.sufixo)) ?? "";
    expect(gravada).not.toContain("99999-0001");
    expect(gravada).not.toContain("joao@teste.com");
    expect(gravada).not.toContain("@joao.nomad");
    await page.context().close();
  });
});
