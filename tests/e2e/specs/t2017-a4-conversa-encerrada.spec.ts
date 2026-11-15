import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2017 — Pista 3, lote 2, item A4 @A4 @ao-vivo-seguro — TRAVA NOMEADA (vermelha na main até a correção da Família 6).
  Regra definida pelo coordenador (ORDEM-DUET-068, ponto 2):
    • a conversa ENCERRA quando a candidatura que a originou termina sem contrato (aqui: recusada pelo dono);
    • as duas pontas veem a faixa "Esta conversa foi encerrada em {data}. O histórico continua disponível.", o campo
      de envio some e o histórico continua; para o morador o motivo é neutro — nunca "recusada";
    • uma candidatura NOVA do mesmo morador ao mesmo imóvel reabre a MESMA conversa (id fixo pessoa+pessoa+imóvel),
      com o separador "Nova candidatura em {data}", e o campo volta.
  O caso com contrato (encerra só depois do fim do processo da caução, ≥ 30 dias após a saída) fica para quando a
  correção existir: precisa de contrato encerrado e caução devolvida no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2017.${sufixo}@lab.vivanomads.test`, nome: "Dora Encerra", role: "owner" as const };
const inq = { email: `inq.t2017.${sufixo}@lab.vivanomads.test`, nome: "Iago Encerra", role: "tenant" as const };
const ids: Record<string, string> = {};
const HIST = `Tenho interesse, posso visitar? ${sufixo}`;
const titulo = () => new RegExp(`Studio encerra ${sufixo}`);
const FAIXA = /Esta conversa foi encerrada em \d{2}\/\d{2}\/\d{4}\. O histórico continua disponível\./;

async function abrir(p: Page) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: titulo() }).first().click();
}

test.describe("T2017 — A4: conversa encerrada (trava da Família 6)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio encerra ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, HIST, conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("candidatura recusada → faixa de encerrada, sem campo, histórico mantido; morador sem 'recusada'", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto("/dashboard/leads", { waitUntil: "networkidle" });
    await d.getByRole("button", { name: /^Recusar$/ }).first().click();
    await d.getByPlaceholder("Ou escreva um motivo personalizado…").fill("Já fechei com outra pessoa.");
    await d.getByRole("button", { name: /Confirmar recusa/ }).click();
    await expect.poll(async () => ((await adm().from("leads").select("status").eq("id", ids.lead).single()).data as { status: string }).status, { timeout: 20_000 }).toBe("rejected");

    const i = await entrar(browser, inq.email, senha);
    for (const p of [d, i]) {
      await abrir(p);
      await expect(p.getByText(FAIXA)).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("mensagem-campo")).toHaveCount(0);
      await expect(p.locator("main").getByText(HIST).last()).toBeVisible();
    }
    // O motivo, para o morador, é neutro: nunca "recusada".
    await expect(i.locator("main")).not.toContainText(/recusad|rejeitad/i);
    await d.context().close();
    await i.context().close();
  });

  test("candidatura nova do mesmo morador ao mesmo imóvel reabre a MESMA conversa, com o separador", async ({ browser }) => {
    const conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    ids.lead2 = await criarLead(ids.dono, ids.inq, ids.imovel);
    for (const email of [inq.email, dono.email]) {
      const p = await entrar(browser, email, senha);
      await abrir(p);
      await expect(p.getByText(/Nova candidatura em \d{2}\/\d{2}\/\d{4}/)).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("mensagem-campo")).toBeVisible();
      await expect(p.locator("main").getByText(HIST).last()).toBeVisible();
      await expect(p.locator(`[data-testid="mensagens-conversa"][data-conversa="${conversa}"]`)).toHaveCount(1);
      await p.context().close();
    }
  });
});
