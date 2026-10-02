import { test, expect, type Browser, type Page } from "@playwright/test";
import { account, hasAccount } from "../fixtures/accounts";
import { authFile } from "../fixtures/auth";

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
 * Notas de automação (limites reais da arquitetura):
 *  · Não existe API GET/JSON de pedidos no browser — os dados chegam por Server
 *    Action + VIEW `pedidos_publicos` (mascaramento no Postgres). Por isso a
 *    asserção de B é feita no FIO (todos os response bodies, incl. payload RSC):
 *    o conteúdo do pedido aparece, a identidade (e-mail/sobrenome) não.
 *  · O /dashboard/fechamento usa um imóvel-amostra fixo; o valor exato
 *    R$ 12.800 (4 × 3.200) é coberto por unidade (contrato-blocos.test.ts). Aqui
 *    validamos a ESTRUTURA (2 blocos, caução 50%, comissão única) para 4 meses.
 */

/** Imóvel semeado por scripts/seed-test-data.mjs (proprietário-teste, R$ 3.200). */
const SEED_PROPERTY_ID =
  process.env.TESTES_SEED_PROPERTY_ID || "11111111-1111-4111-8111-111111111111";

/** Marca única por execução para rastrear o pedido criado sem colidir. */
function marca(): string {
  return `TRAV${Date.now().toString().slice(-7)}`;
}

/** Última palavra do nome = sobrenome (o que NÃO pode vazar antes do aceite). */
function sobrenome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

// ───────────────────────────── B — Identidade protegida ─────────────────────
test.describe("T-TRAV-B — Pedido: identidade não vaza antes do aceite @criticos", () => {
  /** Cria um pedido de moradia (Uberlândia, para casar com o imóvel semeado). */
  async function publicarPedido(page: Page, tag: string): Promise<void> {
    await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
    await page.getByPlaceholder("Uberlândia").fill("Uberlândia");
    await page.getByPlaceholder("MG").fill("MG");
    await page.getByPlaceholder("dd/mm/aaaa").fill("15/09/2026");
    await page.locator('input[type="number"]').first().fill("2");
    await page.getByPlaceholder("3500").fill("3200");
    // Motivo é um dropdown custom (listbox/option).
    await page.getByText(/Selecione o motivo da estadia/i).click();
    await page.getByRole("option").first().click();
    // Apresentação carrega a marca — deve APARECER para o dono (conteúdo flui).
    await page
      .getByPlaceholder(/Conte um pouco do seu perfil/i)
      .fill(`Perfil de teste ${tag}. Procuro imovel mobiliado de media duracao.`);
    await page.getByRole("button", { name: /Publicar pedido/i }).click();
    // Sucesso → cai na lista do inquilino.
    await page.waitForURL(/\/dashboard\/pedidos/, { timeout: 20_000 });
  }

  /** Marca todos os pedidos ativos como atendidos (libera o limite de 2). */
  async function limparPedidos(browser: Browser): Promise<void> {
    const ctx = await browser.newContext({ storageState: authFile("inquilino") });
    const page = await ctx.newPage();
    await page.goto("/dashboard/pedidos", { waitUntil: "networkidle" });
    for (let i = 0; i < 10; i++) {
      const botao = page.getByRole("button", { name: /Marcar atendido/i }).first();
      if (!(await botao.isVisible().catch(() => false))) break;
      await botao.click();
      await page.waitForTimeout(500);
    }
    await ctx.close();
  }

  test("o dono vê o pedido, mas nunca o e-mail/sobrenome do inquilino", async ({ browser }) => {
    const inq = account("inquilino");
    const tag = marca();

    // (1) Inquilino publica o pedido.
    const ctxInq = await browser.newContext({ storageState: authFile("inquilino") });
    const pageInq = await ctxInq.newPage();
    try {
      await publicarPedido(pageInq, tag);
    } catch (e) {
      await ctxInq.close();
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

    // A REGRA DE OURO: e-mail e sobrenome do inquilino não podem trafegar.
    expect(fio, "e-mail do inquilino vazou no fio pré-aceite").not.toContain(inq.email);
    if (sn) {
      expect(fio, "sobrenome do inquilino vazou no fio pré-aceite").not.toContain(sn);
    }

    await ctxDono.close();
    await limparPedidos(browser);
  });

  test.afterAll(async ({ browser }) => {
    // Salvaguarda: garante que nenhum pedido de teste ficou ativo.
    const ctx = await browser.newContext({ storageState: authFile("inquilino") });
    const page = await ctx.newPage();
    await page.goto("/dashboard/pedidos", { waitUntil: "networkidle" }).catch(() => {});
    for (let i = 0; i < 10; i++) {
      const botao = page.getByRole("button", { name: /Marcar atendido/i }).first();
      if (!(await botao.isVisible().catch(() => false))) break;
      await botao.click();
      await page.waitForTimeout(500);
    }
    await ctx.close();
  });
});

// ──────────────────── C — Candidatura sem verificação: nudge ─────────────────
test.describe("T-TRAV-C — Candidatura sem verificação = confirmação + nudge @criticos", () => {
  test.use({ storageState: authFile("inquilino") });

  test("candidatar-se confirma e convida a verificar — nunca bloqueia", async ({ page }) => {
    await page.goto(`/imoveis/${SEED_PROPERTY_ID}`, { waitUntil: "networkidle" });
    const candidatar = page.getByRole("button", { name: /^Candidatar-se$/i });
    if (!(await candidatar.isVisible().catch(() => false))) {
      test.skip(true, "Imóvel semeado ausente — rode `npm run seed:teste` no projeto de teste.");
      return;
    }
    await candidatar.click();

    // Confirmação (nunca "fechamento"/bloqueio).
    await expect(page.getByText(/Candidatura enviada/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Acompanhar em Mensagens/i })).toBeVisible();
    // Nudge de verificação — convite, não porta.
    await expect(page.getByText(/Aumente suas chances/i)).toBeVisible();
    // NUNCA linguagem de bloqueio/impedimento na confirmação da candidatura.
    await expect(page.getByText(/Candidatura enviada/i).locator("xpath=ancestor::*[1]")).not.toContainText(
      /bloquead|imped|não pode|precisa verificar antes/i,
    );
  });

  test("acompanhamento em /dashboard/candidaturas usa vocabulário digno (nunca 'recusada')", async ({
    page,
  }) => {
    // Garante ao menos uma candidatura (idempotente — dedup por imóvel+inquilino).
    await page.goto(`/imoveis/${SEED_PROPERTY_ID}`, { waitUntil: "networkidle" });
    const candidatar = page.getByRole("button", { name: /^Candidatar-se$/i });
    if (await candidatar.isVisible().catch(() => false)) {
      await candidatar.click();
      await expect(page.getByText(/Candidatura enviada/i)).toBeVisible({ timeout: 15_000 });
    }

    await page.goto("/dashboard/candidaturas", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Minhas candidaturas/i })).toBeVisible();
    // A página existe e sobrevive ao reload (estado no servidor, não no cliente).
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Minhas candidaturas/i })).toBeVisible();
    // NUNCA jargão de recusa na tela do inquilino.
    await expect(page.locator("body")).not.toContainText(/recusad|rejeitad/i);
  });
});

// ─────────────────── D — Fechamento herda a candidatura aceita ───────────────
test.describe("T-TRAV-D — Fechamento herda a candidatura aceita real @criticos", () => {
  test("candidatura aceita → fechamento com imóvel real, 2 blocos e R$ 12.800", async ({
    browser,
  }) => {
    // (1) Inquilino candidata-se ao imóvel semeado (R$ 3.200/mês). Idempotente.
    const ctxInq = await browser.newContext({ storageState: authFile("inquilino") });
    const pageInq = await ctxInq.newPage();
    await pageInq.goto(`/imoveis/${SEED_PROPERTY_ID}`, { waitUntil: "networkidle" });
    const candidatar = pageInq.getByRole("button", { name: /^Candidatar-se$/i });
    if (!(await candidatar.isVisible().catch(() => false))) {
      await ctxInq.close();
      test.skip(true, "Imóvel semeado ausente — rode `npm run seed:teste` no projeto de teste.");
      return;
    }
    await candidatar.click();
    await expect(pageInq.getByText(/Candidatura enviada/i)).toBeVisible({ timeout: 15_000 });
    await ctxInq.close();

    // (2) Proprietário ACEITA a candidatura (persiste + congela a comissão).
    const ctxDono = await browser.newContext({ storageState: authFile("proprietario") });
    const pageDono = await ctxDono.newPage();
    await pageDono.goto("/dashboard/leads", { waitUntil: "networkidle" });
    const aprovar = pageDono.getByRole("button", { name: /Aprovar e responder/i }).first();
    if (await aprovar.isVisible().catch(() => false)) {
      await aprovar.click();
      await pageDono.waitForTimeout(1500); // deixa o server action persistir
    }
    // (se já estava aceita de uma execução anterior, seguimos direto)

    // (3) Fechamento herda a candidatura: imóvel real (R$ 3.200), 4 meses → 2
    //     blocos, total R$ 12.800, e a comissão congelada do plano no aceite.
    await pageDono.goto("/dashboard/fechamento", { waitUntil: "networkidle" });
    // Nunca a guarda "sem candidatura" — o fechamento agora EXISTE.
    await expect(pageDono.getByText(/Nenhuma candidatura aceita/i)).toHaveCount(0);

    const prazo = pageDono.getByLabel(/Prazo total em meses/i);
    if (await prazo.isVisible().catch(() => false)) await prazo.selectOption("4");

    await expect(pageDono.getByText(/2 blocos/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(pageDono.getByText(/total do per[íi]odo/i).first()).toBeVisible();
    // Valor exato herdado do imóvel semeado (3.200 × 4).
    await expect(pageDono.locator("body")).toContainText(/12\.800/);

    // Avança até o resumo e confere a comissão congelada ("plano Y").
    for (let i = 0; i < 6; i++) {
      if (await pageDono.getByText(/Comissão deste contrato/i).first().isVisible().catch(() => false)) break;
      const continuar = pageDono.getByRole("button", { name: /Continuar/i }).first();
      if (!(await continuar.isVisible().catch(() => false))) break;
      await continuar.click();
      await pageDono.waitForTimeout(400);
    }
    const comissao = pageDono.getByText(/Comissão deste contrato/i).first();
    if (await comissao.isVisible().catch(() => false)) {
      await expect(comissao).toContainText(/%.*plano/i);
    }
    await ctxDono.close();
  });
});

// ─────────────────────── F — Chat: contato mascarado ─────────────────────────
test.describe("T-TRAV-F — Chat mascara telefone, e-mail e @rede social @criticos", () => {
  test.use({ storageState: authFile("inquilino") });
  const MASK = "🔒 [contato protegido]";

  test("os 3 padrões viram '[contato protegido]' no envio", async ({ page }) => {
    await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    const campo = page.getByPlaceholder(/Escreva uma mensagem/i);
    if (!(await campo.isVisible().catch(() => false))) {
      test.skip(true, "Sem conversa aberta no banco de teste — nada onde enviar mensagem.");
      return;
    }
    // Seleciona a primeira conversa da lista, se houver uma navegação de threads.
    const primeira = page.locator('[role="button"], button, a').filter({ hasText: /./ }).first();
    await primeira.click().catch(() => {});

    const texto = "liga (34) 99999-0001, e-mail joao@teste.com ou me segue @joao.nomad";
    await campo.fill(texto);
    await page.getByRole("button", { name: /^Enviar$/i }).click();

    // O eco otimista já deve vir mascarado (mesma função do servidor).
    await expect(page.getByText(MASK).last()).toBeVisible({ timeout: 10_000 });
    const corpo = page.locator("body");
    await expect(corpo).not.toContainText("99999-0001");
    await expect(corpo).not.toContainText("joao@teste.com");
    await expect(corpo).not.toContainText("@joao.nomad");
    // Aviso de proteção aparece.
    await expect(page.getByText(/telefones e e-mails são protegidos/i)).toBeVisible();
  });
});
