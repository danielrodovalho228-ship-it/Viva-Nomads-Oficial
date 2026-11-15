import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2016 — Pista 3, lote 2, item A3 @E200 @E569 @ao-vivo-seguro. Regra: depois do aceite da candidatura, a conversa
  continua na MESMA thread — as mensagens de antes e de depois têm o mesmo conversation_id e a lista dos dois lados
  mostra uma conversa só daquele imóvel, com o histórico inteiro. Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2016.${sufixo}@lab.vivanomads.test`, nome: "Dirce Thread", role: "owner" as const };
const inq = { email: `inq.t2016.${sufixo}@lab.vivanomads.test`, nome: "Ian Thread", role: "tenant" as const };
const ids: Record<string, string> = {};
const ANTES = `antes do aceite ${sufixo}`;
const DEPOIS = `depois do aceite ${sufixo}`;
const titulo = () => new RegExp(`Studio da thread ${sufixo}`);

test.describe("T2016 — A3: depois do aceite, a mesma conversa @E200", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da thread ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, ANTES, conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("id", ids.lead ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("a mensagem depois do aceite cai na conversa de antes, e as duas pontas veem uma conversa só", async ({ browser }) => {
    const antes = ((await adm().from("messages").select("conversation_id").eq("property_id", ids.imovel).single()).data as { conversation_id: string }).conversation_id;
    const { error } = await adm().from("leads").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", ids.lead);
    expect(error).toBeNull();

    const d = await entrar(browser, dono.email, senha);
    await d.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await expect(d.getByRole("button", { name: titulo() })).toHaveCount(1);
    await d.getByRole("button", { name: titulo() }).first().click();
    await d.getByTestId("mensagem-campo").fill(DEPOIS);
    await d.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(async () => ((await adm().from("messages").select("id").eq("property_id", ids.imovel)).data ?? []).length, { timeout: 20_000 }).toBe(2);
    const convs = ((await adm().from("messages").select("conversation_id").eq("property_id", ids.imovel)).data ?? []).map((m) => m.conversation_id);
    expect(new Set(convs)).toEqual(new Set([antes]));
    expect(antes).toBe(conversationId(ids.inq, ids.dono, ids.imovel));

    for (const pagina of [d, await entrar(browser, inq.email, senha)]) {
      await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
      const itens = pagina.getByRole("button", { name: titulo() });
      await expect(itens).toHaveCount(1);
      await itens.first().click();
      await expect(pagina.locator("main").getByText(ANTES, { exact: true }).last()).toBeVisible();
      await expect(pagina.locator("main").getByText(DEPOIS, { exact: true }).last()).toBeVisible();
      await expect(pagina.locator(`[data-testid="mensagens-conversa"][data-conversa="${antes}"]`)).toHaveCount(1);
      await pagina.context().close();
    }
  });
});
