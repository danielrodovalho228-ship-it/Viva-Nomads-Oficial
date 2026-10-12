import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T43 — NOTIFICAÇÕES (laboratório, ordem 225d0648).
 *  1. Push simulado: o app (Expo) avisa o site pelo evento `viva:push-token`; com o usuário logado o token
 *     é gravado em `push_tokens` (upsert pelo token, dono = sessão). Token malformado NÃO grava.
 *  2. Aviso por e-mail: mensagem do inquilino ao dono cai no LAB_OUTBOX (nada sai para a rede), sem telefone.
 *  3. Tela de Notificações da Conta (o "sininho" do menu): os avisos por e-mail e WhatsApp podem ser desligados.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.not.${sufixo}@lab.vivanomads.test`, nome: "Nilza Notifica", role: "owner" as const };
const inq = { email: `inq.not.${sufixo}@lab.vivanomads.test`, nome: "Nando Notifica", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const TOKEN = `ExponentPushToken[lab${sufixo}aaaaaaaaaaaaaaaa]`;

test.describe("T43 — Notificações", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das notificações ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Bem-vindo! Qualquer dúvida, escreva por aqui.", conversationId(ids.dono, ids.inq, ids.imovel));
  });

  test.afterAll(async () => {
    await adm().from("push_tokens").delete().eq("user_id", ids.inq ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("push simulado: o token do aparelho é gravado para o usuário logado; token inválido não", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.evaluate((token) => {
      window.dispatchEvent(new CustomEvent("viva:push-token", { detail: { token: "lixo", platform: "android" } }));
      window.dispatchEvent(new CustomEvent("viva:push-token", { detail: { token, platform: "android" } }));
    }, TOKEN);
    await expect
      .poll(async () => (await adm().from("push_tokens").select("user_id, platform").eq("token", TOKEN)).data?.[0]?.user_id ?? null, { timeout: 20_000 })
      .toBe(ids.inq);
    const { data: lixo } = await adm().from("push_tokens").select("id").eq("token", "lixo");
    expect(lixo ?? []).toHaveLength(0);
    await page.context().close();
  });

  test("a mensagem do inquilino avisa o dono por e-mail (LAB_OUTBOX), sem telefone no aviso", async ({ browser }) => {
    test.skip(!process.env.LAB_OUTBOX, "sem LAB_OUTBOX nesta execução");
    test.setTimeout(90_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Studio das notificações/ }).first().click();
    await page.getByPlaceholder("Escreva uma mensagem...").fill("Posso visitar amanhã? Meu número é 31 91234-5678.");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect
      .poll(async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === dono.email).length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    const aviso = (await lerSaida()).filter((l) => l.servico === "email" && l.para === dono.email).map((l) => JSON.stringify(l)).join("\n");
    expect(aviso).not.toMatch(/91234|5678/);
    await page.context().close();
  });

  test("Conta › Notificações: desligar o aviso por e-mail grava no perfil", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/conta/notificacoes", { waitUntil: "networkidle" });
    await expect(page.getByText("Avisos por WhatsApp")).toBeVisible();
    const chave = page.getByRole("switch", { name: "Avisos por e-mail" });
    await expect(chave).toBeEnabled({ timeout: 15_000 });
    await chave.click();
    await expect.poll(async () => (await adm().from("profiles").select("notif_email").eq("id", ids.dono!).single()).data?.notif_email, { timeout: 15_000 }).toBe(false);
    await page.context().close();
  });
});
