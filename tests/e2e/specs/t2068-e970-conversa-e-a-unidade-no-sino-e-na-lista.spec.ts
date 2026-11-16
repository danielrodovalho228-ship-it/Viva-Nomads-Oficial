import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2068 — E970 (Pista 3; autorizado pelo Gerente na ronda 02:55Z) @E970 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave de serviço).
  Regra decidida (ORDEM-DUET-068, ponto 3): a unidade é a CONVERSA em TODAS as contagens.
    - Sino: o número do sino conta conversas com mensagem não lida (um aviso por conversa), e a lista do sino traz UM
      aviso não lido por conversa — nunca um por mensagem.
    - Lista de Mensagens: o número de conversas com não lidas é o mesmo do sino; o número de MENSAGENS não lidas só
      aparece dentro da linha de cada conversa.
    - Ler uma conversa tira UMA unidade do sino e zera só a linha dela.
  Cenário: 2 mensagens não lidas no Alfa e 1 no Beta → sino 2 (a 1280 e a 390 px), lista do sino com 2 avisos não
  lidos (Alfa e Beta), linhas 2 e 1; abre o Alfa → sino 1, linha do Alfa 0, linha do Beta 1.
  Complementa o t2018 (selo da aba Mensagens) sem repeti-lo.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2068.${sufixo}@lab.vivanomads.test`, nome: "Dora Sino", role: "owner" as const };
const inq = { email: `inq.t2068.${sufixo}@lab.vivanomads.test`, nome: "Ivo Lista", role: "tenant" as const };
const ids: Record<string, string> = {};
const alfa = `Studio Alfa ${sufixo}`;
const beta = `Studio Beta ${sufixo}`;

// Envia pela tela (o caminho real: grava a mensagem E dispara o aviso do sino do destinatário).
async function enviar(p: Page, imovel: string, texto: string) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(imovel) }).first().click();
  await p.getByTestId("mensagem-campo").fill(texto);
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(async () => ((await adm().from("messages").select("id").eq("body", texto)).data ?? []).length, { timeout: 20_000 }).toBe(1);
}

const sino = (p: Page) => p.locator('[data-testid^="sino-"][aria-label^="Notificações"]:visible').first();
const linha = (p: Page, conversa: string) => p.locator(`[data-testid="mensagens-conversa"][data-conversa="${conversa}"]`);

test.describe("T2068 — E970: a conversa é a unidade no sino e na lista @E970", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.a = await criarImovelPronto(ids.dono, alfa, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, beta, { ativo: true });
    ids.ca = conversationId(ids.inq, ids.dono, ids.a);
    ids.cb = conversationId(ids.inq, ids.dono, ids.b);
    // As duas conversas abertas pelo dono (já lidas pelo morador), para o morador responder pela tela.
    await gravarMensagem(ids.dono, ids.inq, ids.a, "Oi, sobre o Alfa.", ids.ca);
    await gravarMensagem(ids.dono, ids.inq, ids.b, "Oi, sobre o Beta.", ids.cb);
    await adm().from("messages").update({ lido_em: new Date().toISOString() }).eq("sender_id", ids.dono);
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().in("property_id", [ids.a ?? "", ids.b ?? ""]);
    await adm().from("avisos").delete().in("usuario_id", [ids.dono ?? "", ids.inq ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o morador escreve 2 mensagens no Alfa e 1 no Beta", async ({ browser }) => {
    const i = await entrar(browser, inq.email, senha);
    await enviar(i, alfa, `Alfa 1 ${sufixo}`);
    await enviar(i, alfa, `Alfa 2 ${sufixo}`);
    await enviar(i, beta, `Beta 1 ${sufixo}`);
    await i.context().close();
  });

  for (const largura of [1280, 390]) {
    test(`${largura} px — o sino conta 2 conversas e a sua lista traz um aviso por conversa`, async ({ browser }) => {
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura >= 1024 ? 900 : 800 });
      await d.goto("/dashboard/leads", { waitUntil: "domcontentloaded" }); // fora de Mensagens: nada é marcado como lido
      await expect(sino(d)).toHaveAttribute("aria-label", "Notificações: 2 não lidas", { timeout: 30_000 });
      await sino(d).click();
      const naoLidos = d.locator('[data-testid="sino-aviso"][data-lido="nao"]');
      await expect(naoLidos).toHaveCount(2, { timeout: 15_000 });
      await expect(naoLidos.filter({ hasText: alfa })).toHaveCount(1);
      await expect(naoLidos.filter({ hasText: beta })).toHaveCount(1);
      await d.context().close();
    });
  }

  test("1280 px — a lista de Mensagens: 2 conversas com não lidas (= sino), 2 e 1 mensagens dentro das linhas", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    // Abre a lista sem abrir conversa nenhuma (a conversa aberta marcaria como lida): um id que não está na lista não
    // abre nada (conversaInicial → null; "Esta conversa não está na sua lista").
    await d.goto("/dashboard/mensagens?conversa=nenhuma", { waitUntil: "networkidle" });
    await expect(linha(d, ids.ca)).toBeVisible({ timeout: 30_000 });
    await expect(d.locator('[data-testid="mensagens-conversa"]:not([data-nao-lidas="0"])')).toHaveCount(2);
    await expect(linha(d, ids.ca).getByTestId("mensagens-nao-lidas")).toHaveText("2");
    await expect(linha(d, ids.cb).getByTestId("mensagens-nao-lidas")).toHaveText("1");
    await expect(sino(d)).toHaveAttribute("aria-label", "Notificações: 2 não lidas");
    await d.context().close();
  });

  test("1280 px — ler o Alfa tira UMA unidade do sino e zera só a linha do Alfa", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto(`/dashboard/mensagens?conversa=${ids.ca}`, { waitUntil: "networkidle" });
    await expect(linha(d, ids.ca)).toHaveAttribute("data-nao-lidas", "0", { timeout: 30_000 });
    await expect(linha(d, ids.cb).getByTestId("mensagens-nao-lidas")).toHaveText("1");
    await d.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(sino(d)).toHaveAttribute("aria-label", "Notificações: 1 não lidas", { timeout: 30_000 });
    await d.context().close();
  });
});
