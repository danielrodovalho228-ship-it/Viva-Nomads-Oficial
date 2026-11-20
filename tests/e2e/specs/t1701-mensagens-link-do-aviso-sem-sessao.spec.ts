import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { urlDaConversa } from "../../../src/lib/notifications/url-conversa";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, liberarLimiteCodigo, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1701 — linha Mensagens, casca e sessão (ORDEM-DUET-281; aprovada pelo Gerente na ORDEM-DUET-285): o link do aviso "Nova
  mensagem recebida" (/dashboard/mensagens?conversa=<id>, E541) aberto SEM sessão manda ao login guardando o destino
  inteiro (proxy.ts), e depois de entrar a pessoa cai NA conversa pedida, não na primeira da lista nem no Início.
  Montagem: o dono tem duas conversas; a pedida é a ANTIGA (não é a do topo), para a prova distinguir "abriu a pedida"
  de "abriu a primeira". A 390 e a 1280 px, pelas duas entradas: por código (a entrada normal, sem senha) e por senha.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1701.${sufixo}@lab.vivanomads.test`, nome: "Lia Link", role: "owner" as const };
const inqA = { email: `inqa.t1701.${sufixo}@lab.vivanomads.test`, nome: "Antonio Antigo", role: "tenant" as const };
const inqB = { email: `inqb.t1701.${sufixo}@lab.vivanomads.test`, nome: "Rita Recente", role: "tenant" as const };
const ids: Record<string, string> = {};
const conv: { antiga?: string; recente?: string } = {};
const ha = (ms: number) => new Date(Date.now() - ms).toISOString();
const HORA = 3_600_000;

/** Entra pela tela de senha SEM perder o destino guardado na URL (o ?redirect= que o proxy pôs). */
async function entrarMantendoODestino(page: Page, email: string) {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  const u = new URL(page.url());
  u.searchParams.set("senha", "1");
  await page.goto(u.pathname + u.search, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/\/dashboard/.test(new URL(page.url()).pathname)) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== email) await campoEmail.fill(email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
}

/**
 * Entra POR CÓDIGO na própria tela de login a que o proxy mandou (a entrada normal, t300), sem sair dela: o destino
 * guardado na URL tem de sobreviver ao pedido do código e à confirmação. No lab o código vem do Supabase local.
 */
async function entrarPorCodigoMantendoODestino(page: Page, email: string, destinoEsperado: string) {
  await liberarLimiteCodigo();
  const tela = page.getByTestId("login-por-codigo");
  await expect(async () => {
    if (await page.getByTestId("campo-codigo").isVisible()) return;
    const campo = tela.getByPlaceholder("E-mail");
    if ((await campo.inputValue({ timeout: 4_000 })) !== email) await campo.fill(email, { timeout: 4_000 });
    await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
    await expect(page.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
  const { data, error } = await adm().auth.admin.generateLink({ type: "magiclink", email });
  expect(error, error?.message).toBeNull();
  const codigo = data?.properties?.email_otp ?? "";
  expect(codigo).toMatch(/^\d{6}$/);
  await page.getByTestId("campo-codigo").fill(codigo);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // A conta do laboratório ainda não respondeu à pergunta da intenção: o 1.º código passa por /auth/intencao (Prompt 49).
  // O destino tem de atravessar essa tela: fica na URL e é para onde o "Agora não" leva (painelInicial).
  await page.waitForURL(/\/auth\/intencao|\/dashboard\//, { timeout: 45_000 });
  if (new URL(page.url()).pathname === "/auth/intencao") {
    expect(new URL(page.url()).searchParams.get("redirect"), "a tela da intenção guarda o destino inteiro").toBe(destinoEsperado);
    await page.getByTestId("intencao-agora-nao").click();
  }
}

test.describe("T1701 — Mensagens: o link do aviso, aberto sem sessão, volta à conversa pedida depois do login", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas novas e a chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    ids.imovelA = await criarImovelPronto(ids.dono, `Studio da conversa antiga ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Studio da conversa recente ${sufixo}`, { ativo: true });
    conv.antiga = conversationId(ids.inqA, ids.dono, ids.imovelA);
    conv.recente = conversationId(ids.inqB, ids.dono, ids.imovelB);
    const msg = (de: string, imovel: string, conversa: string, body: string, criada: string) => ({ conversation_id: conversa, sender_id: de, receiver_id: ids.dono, property_id: imovel, body, created_at: criada });
    const { error } = await adm()
      .from("messages")
      .insert([
        msg(ids.inqA, ids.imovelA, conv.antiga, "Oi, ainda está disponível?", ha(72 * HORA)),
        msg(ids.inqB, ids.imovelB, conv.recente, "Olá! Aceita pet pequeno?", ha(1 * HORA)),
      ]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().in("conversation_id", [conv.antiga ?? "", conv.recente ?? ""]);
    await apagarContas([ids.dono, ids.inqA, ids.inqB]);
  });

  for (const largura of [390, 1280] as const) for (const entrada of ["código", "senha"] as const) {
    test(`${largura} px, entrada por ${entrada} — sem sessão, o link vai ao login com o destino; depois de entrar, abre a conversa pedida`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      const destino = urlDaConversa(conv.antiga);
      expect(destino, "o endereço do aviso leva a conversa").toBe(`/dashboard/mensagens?conversa=${conv.antiga}`);

      // 1. Sem sessão: login, com o destino INTEIRO guardado (caminho + ?conversa=).
      await page.goto(destino, { waitUntil: "domcontentloaded" });
      await expect(page, "sem sessão vai ao login").toHaveURL(/\/auth\?/, { timeout: 20_000 });
      expect(new URL(page.url()).searchParams.get("redirect"), "o login guarda o destino inteiro").toBe(destino);

      // 2. Entra: cai na conversa pedida.
      if (entrada === "código") await entrarPorCodigoMantendoODestino(page, dono.email, destino);
      else await entrarMantendoODestino(page, dono.email);
      await expect(page, "depois do login volta ao endereço da conversa").toHaveURL(new RegExp(`/dashboard/mensagens\\?conversa=${conv.antiga}`), { timeout: 30_000 });
      // A conversa aberta diz-se pelo imóvel do cabeçalho: o nome do candidato fica escondido do dono ("Candidato(a)").
      await expect(page.getByTestId("conversa-contexto"), "a conversa aberta é a pedida (a antiga), não a do topo").toContainText(`Studio da conversa antiga ${sufixo}`, { timeout: 30_000 });
      await expect(page.getByTestId("conversa-contexto")).not.toContainText("conversa recente");
      await expect(page.getByTestId("mensagens-conversa-nao-encontrada")).toHaveCount(0);
      await expect(page.getByTestId("mensagem-campo"), "dá para responder").toBeVisible();
      await ctx.close();
    });
  }
});
