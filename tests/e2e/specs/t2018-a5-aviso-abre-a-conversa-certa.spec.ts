import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2018 — Pista 3, lote 2, item A5 (parte que vale na main) @E481 @E533 @ao-vivo-seguro.
  Regra: o aviso de mensagem nova abre a conversa CERTA (/dashboard/mensagens?conversa=<id>); abri-la zera as não
  lidas dela na lista e tira o aviso do sino na hora, sem recarregar; a outra conversa segue com o número de mensagens
  não lidas dela.
  Fora daqui (divergência registrada no PR): "a lista e o sino batem" — a lista conta MENSAGENS e o sino um aviso por
  conversa (renovado), então 2 mensagens dão "2" na lista e "1" no sino. Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2018.${sufixo}@lab.vivanomads.test`, nome: "Dina Aviso", role: "owner" as const };
const inq = { email: `inq.t2018.${sufixo}@lab.vivanomads.test`, nome: "Igor Aviso", role: "tenant" as const };
const ids: Record<string, string> = {};

async function enviarComoMorador(p: Page, imovel: string, texto: string) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(imovel) }).first().click();
  await p.getByTestId("mensagem-campo").fill(texto);
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
}

test.describe("T2018 — A5: o aviso abre a conversa certa e zera sem recarregar @E481", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.a = await criarImovelPronto(ids.dono, `Studio Alfa ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, `Studio Beta ${sufixo}`, { ativo: true });
    // Uma conversa em cada imóvel, aberta pelo dono (o morador responde nelas pela tela).
    await gravarMensagem(ids.dono, ids.inq, ids.a, "Oi, sobre o Alfa.", conversationId(ids.inq, ids.dono, ids.a));
    await gravarMensagem(ids.dono, ids.inq, ids.b, "Oi, sobre o Beta.", conversationId(ids.inq, ids.dono, ids.b));
    await adm().from("messages").update({ lido_em: new Date().toISOString() }).eq("sender_id", ids.dono);
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().in("property_id", [ids.a ?? "", ids.b ?? ""]);
    await adm().from("avisos").delete().in("usuario_id", [ids.dono ?? "", ids.inq ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1280 px — dono: clica o aviso do Alfa, cai no Alfa; o Beta segue com 1 não lida", async ({ browser }) => {
    const i = await entrar(browser, inq.email, senha);
    await enviarComoMorador(i, `Studio Alfa ${sufixo}`, `Alfa: chego dia 10 ${sufixo}`);
    await enviarComoMorador(i, `Studio Beta ${sufixo}`, `Beta: tem vaga? ${sufixo}`);
    await expect.poll(async () => ((await adm().from("avisos").select("id").eq("usuario_id", ids.dono).eq("evento", "new_message").is("lido_em", null)).data ?? []).length, { timeout: 30_000 }).toBe(2);
    await i.context().close();

    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const sino = d.getByTestId("topo-dono").getByTestId("sino-dono");
    await expect(sino).toHaveAttribute("aria-label", /Notificações: 2 não lidas/, { timeout: 30_000 });
    await sino.click();
    const aviso = d.getByTestId("sino-dono-painel").getByTestId("sino-aviso").filter({ hasText: `Studio Alfa ${sufixo}` });
    await expect(aviso).toHaveCount(1);
    await aviso.click();

    const alfa = conversationId(ids.inq, ids.dono, ids.a);
    const beta = conversationId(ids.inq, ids.dono, ids.b);
    await expect(d).toHaveURL(new RegExp(`/dashboard/mensagens\\?conversa=${alfa}`), { timeout: 30_000 });
    await expect(d.locator("main").getByText(`Alfa: chego dia 10 ${sufixo}`).last()).toBeVisible();
    // Zera sem recarregar: o Alfa sem contagem, o Beta com 1 (a mensagem dele), e o sino com 1.
    await expect(d.locator(`[data-testid="mensagens-conversa"][data-conversa="${alfa}"]`)).toHaveAttribute("data-nao-lidas", "0", { timeout: 15_000 });
    await expect(d.locator(`[data-testid="mensagens-conversa"][data-conversa="${beta}"]`)).toHaveAttribute("data-nao-lidas", "1");
    await expect(d.locator(`[data-testid="mensagens-conversa"][data-conversa="${beta}"]`).getByTestId("mensagens-nao-lidas")).toHaveText("1");
    await expect(sino).toHaveAttribute("aria-label", /Notificações: 1 não lidas/, { timeout: 15_000 });
    await d.context().close();
  });
});
