import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T41 — MENSAGENS inquilino ↔ dono (laboratório, ordem 225d0648).
 *  1. O dono recebe a mensagem do inquilino e responde pela tela de Mensagens.
 *  2. Telefone e e-mail digitados no chat são MASCARADOS antes de gravar (o banco nunca guarda o número),
 *     e o inquilino recebe a resposta já mascarada. Aparece o aviso "telefones e e-mails são protegidos".
 *  3. Interessados (prompt 6): antes do aceite o dono vê "Candidato(a)", sem nome; depois, o nome curto —
 *     e o chat continua mascarado (contato direto não é trocado nem depois do aceite).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.msg.${sufixo}@lab.vivanomads.test`, nome: "Dora Donamensagem", role: "owner" as const };
const inq = { email: `inq.msg.${sufixo}@lab.vivanomads.test`, nome: "Iara Inquilinasobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T41 — Mensagens inquilino ↔ dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das mensagens ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, "Olá! Tenho interesse no studio.", conversationId(ids.inq, ids.dono, ids.imovel));
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o dono recebe e responde; telefone e e-mail saem mascarados e o inquilino recebe assim", async ({ browser }) => {
    test.setTimeout(120_000);
    const paginaDono = await entrar(browser, dono.email, senha);
    await paginaDono.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await paginaDono.getByRole("button", { name: /Studio das mensagens/ }).first().click();
    // A frase aparece na lista (prévia) e na conversa aberta: a bolha é a última.
    await expect(paginaDono.getByText("Olá! Tenho interesse no studio.").last()).toBeVisible();

    await paginaDono.getByPlaceholder("Escreva uma mensagem...").fill("Claro! Me chama no (34) 99999-8888 ou em dora@exemplo.com");
    await paginaDono.getByRole("button", { name: "Enviar" }).click();
    await expect(paginaDono.getByText(/telefones e e-mails são protegidos/)).toBeVisible();

    // O banco guardou a resposta SEM número nem e-mail.
    await expect
      .poll(async () => {
        const { data } = await adm().from("messages").select("body").eq("sender_id", ids.dono!).eq("property_id", ids.imovel!);
        return data?.length ?? 0;
      })
      .toBe(1);
    const { data: gravada } = await adm().from("messages").select("body").eq("sender_id", ids.dono!).eq("property_id", ids.imovel!).single();
    expect(gravada?.body).toContain("Claro!");
    expect(gravada?.body).not.toMatch(/99999|8888|@exemplo/);

    // O inquilino abre as mensagens e lê a resposta mascarada.
    const paginaInq = await entrar(browser, inq.email, senha);
    await paginaInq.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await paginaInq.getByRole("button", { name: /Studio das mensagens/ }).first().click();
    await expect(paginaInq.getByText(/Claro!/).last()).toBeVisible();
    await expect(paginaInq.locator("body")).not.toContainText("99999-8888");
    await expect(paginaInq.locator("body")).not.toContainText("dora@exemplo.com");
    await paginaDono.context().close();
    await paginaInq.context().close();
  });

  test("a mensagem do inquilino com telefone também é mascarada no servidor", async ({ browser }) => {
    test.setTimeout(90_000);
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /Studio das mensagens/ }).first().click();
    await pagina.getByPlaceholder("Escreva uma mensagem...").fill("Meu zap é 11 98888-7777, pode chamar.");
    await pagina.getByRole("button", { name: "Enviar" }).click();
    await expect.poll(async () => (await adm().from("messages").select("id").eq("sender_id", ids.inq!).eq("property_id", ids.imovel!)).data?.length ?? 0).toBe(2);
    const { data } = await adm().from("messages").select("body").eq("sender_id", ids.inq!).eq("property_id", ids.imovel!);
    for (const m of data ?? []) expect(m.body as string).not.toMatch(/98888|7777/);
    await pagina.context().close();
  });

  test("dono: 'Candidato(a)' antes do aceite; nome curto depois — e o chat segue mascarado", async ({ browser }) => {
    test.setTimeout(90_000);
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.goto("/dashboard/leads", { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("candidato-nome").first()).toHaveText("Candidato(a)");
    await expect(pagina.locator("main")).not.toContainText("Iara");
    await expect(pagina.locator("body")).not.toContainText("Inquilinasobrenome");

    const { error } = await adm().from("leads").update({ status: "accepted" }).eq("id", ids.lead!);
    expect(error).toBeNull();
    await pagina.reload({ waitUntil: "networkidle" });
    await expect(pagina.getByTestId("candidato-nome").first()).toHaveText("Iara I.");
    await expect(pagina.locator("main")).not.toContainText("Inquilinasobrenome");

    // Depois do aceite o chat continua protegido: o contato não é trocado pela conversa.
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /Studio das mensagens/ }).first().click();
    await pagina.getByPlaceholder("Escreva uma mensagem...").fill("Ligue para 21 97777-6666");
    await pagina.getByRole("button", { name: "Enviar" }).click();
    await expect(pagina.getByText(/telefones e e-mails são protegidos/)).toBeVisible();
    await pagina.context().close();
  });
});
