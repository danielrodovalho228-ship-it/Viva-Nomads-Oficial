import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2087 (antes t2018-contagem) — Pista 3, lote 2, item A5 → E970 @E970 @A5 (sem @ao-vivo-seguro: precisa de login e do laboratório) — TRAVA NOMEADA (vermelha na main até a correção da
  Família 6). Regra definida pelo coordenador (ORDEM-DUET-068, ponto 3): a unidade é a CONVERSA em qualquer total —
  o selo da aba Mensagens conta conversas com pelo menos uma não lida; o sino agrupa por conversa (um aviso por
  conversa) e bate com esse selo; o número de MENSAGENS não lidas aparece só dentro da linha de cada conversa.
  Cenário: 2 mensagens não lidas no Alfa e 1 no Beta → selo 2, sino 2, linhas 2 e 1.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2018c.${sufixo}@lab.vivanomads.test`, nome: "Dina Conta", role: "owner" as const };
const inq = { email: `inq.t2018c.${sufixo}@lab.vivanomads.test`, nome: "Igor Conta", role: "tenant" as const };
const ids: Record<string, string> = {};

async function enviar(p: Page, imovel: string, texto: string) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(imovel) }).first().click();
  await p.getByTestId("mensagem-campo").fill(texto);
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(async () => ((await adm().from("messages").select("id").eq("body", texto)).data ?? []).length, { timeout: 20_000 }).toBe(1);
}

test.describe("T2087 — A5: a unidade é a conversa (trava da Família 6)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.a = await criarImovelPronto(ids.dono, `Studio Alfa ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, `Studio Beta ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.a, "Oi, sobre o Alfa.", conversationId(ids.inq, ids.dono, ids.a));
    await gravarMensagem(ids.dono, ids.inq, ids.b, "Oi, sobre o Beta.", conversationId(ids.inq, ids.dono, ids.b));
    await adm().from("messages").update({ lido_em: new Date().toISOString() }).eq("sender_id", ids.dono);
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().in("property_id", [ids.a ?? "", ids.b ?? ""]);
    await adm().from("avisos").delete().in("usuario_id", [ids.dono ?? "", ids.inq ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1280 px — selo da aba = 2 conversas = sino; dentro das linhas, 2 e 1 mensagens", async ({ browser }) => {
    const i = await entrar(browser, inq.email, senha);
    await enviar(i, `Studio Alfa ${sufixo}`, `Alfa 1 ${sufixo}`);
    await enviar(i, `Studio Alfa ${sufixo}`, `Alfa 2 ${sufixo}`);
    await enviar(i, `Studio Beta ${sufixo}`, `Beta 1 ${sufixo}`);
    await i.context().close();

    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto("/dashboard/leads", { waitUntil: "domcontentloaded" }); // fora de Mensagens: nada é marcado como lido
    // Sino: um aviso por conversa → 2.
    await expect(d.getByTestId("topo-dono").getByTestId("sino-dono")).toHaveAttribute("aria-label", "Notificações: 2 não lidas", { timeout: 30_000 });
    // Selo da aba Mensagens: conversas com não lida → 2 (o mesmo número do sino).
    const aba = d.getByTestId("menu-cascata").locator('a[href="/dashboard/mensagens"]').first();
    await expect(aba).toBeVisible();
    await expect(aba).toContainText("2", { timeout: 15_000 });
    await expect(aba).not.toContainText("3");
    // Dentro das linhas: as mensagens de cada conversa.
    await d.goto("/dashboard/mensagens?conversa=" + conversationId(ids.inq, ids.dono, ids.b), { waitUntil: "networkidle" });
    await expect(d.locator(`[data-testid="mensagens-conversa"][data-conversa="${conversationId(ids.inq, ids.dono, ids.a)}"]`).getByTestId("mensagens-nao-lidas")).toHaveText("2");
    await d.context().close();
  });
});
