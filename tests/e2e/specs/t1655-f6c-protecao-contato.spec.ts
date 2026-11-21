import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";

/**
 * T1655 — Família 6, parte C, T3 (tela, 390 px): o inquilino escreve o telefone POR EXTENSO na conversa; o aviso mostra a
 * prévia já mascarada; enviado, o dono vê "[contato protegido]" no lugar do número, e recarregar a página não revela nada.
 * Só no laboratório: cria duas contas, entra com elas e envia mensagem (fluxos que o #3836 proíbe ao vivo).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.f6c3.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const inq = { email: `inq.f6c3.${sufixo}@lab.vivanomads.test`, nome: "Igor Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const MASK = "[contato protegido]";
const SAIDA = "tests/laboratorio/saida";
const TEXTO = "meu número é nove nove nove oito sete seis cinco quatro três, me liga";

test.describe("T1655 — @E955 Família 6 C: telefone por extenso chega mascarado ao outro lado (390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio F6C tela ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel, false);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Oi! O studio está livre, pode perguntar.", conversationId(ids.dono, ids.inq, ids.imovel));
  });
  test.afterAll(async () => {
    if (ids.dono && ids.inq) await adm().from("messages").delete().in("sender_id", [ids.dono, ids.inq]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("telefone por extenso: prévia mascarada, dono vê mascarado, recarregar não revela", async ({ browser }) => {
    test.setTimeout(180_000);
    const conversa = conversationId(ids.dono!, ids.inq!, ids.imovel!);

    const pInq = await entrar(browser, inq.email, senha);
    await pInq.goto(`/dashboard/mensagens?conversa=${conversa}`, { waitUntil: "domcontentloaded" });
    const campo = pInq.getByPlaceholder("Escreva uma mensagem...");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    await campo.fill(TEXTO);
    await campo.press("Enter");
    const previa = pInq.getByTestId("aviso-previa");
    await expect(previa).toContainText(MASK, { timeout: 10_000 });
    await expect(previa).not.toContainText("nove nove");
    await pInq.screenshot({ path: `${SAIDA}/t1655-aviso-390.png` });
    await pInq.getByRole("button", { name: "Enviar mesmo assim" }).click();
    await expect
      .poll(async () => ((await adm().from("messages").select("body").eq("conversation_id", conversa).eq("sender_id", ids.inq!)).data ?? []).map((l) => l.body as string), { timeout: 15_000 })
      .toEqual([expect.stringContaining(MASK)]);
    await pInq.context().close();

    const pDono = await entrar(browser, dono.email, senha);
    for (const vez of ["primeira", "recarregada"] as const) {
      if (vez === "primeira") await pDono.goto(`/dashboard/mensagens?conversa=${conversa}`, { waitUntil: "domcontentloaded" });
      else await pDono.reload({ waitUntil: "domcontentloaded" });
      const bolha = pDono.locator("section").getByText(/meu número é/);
      await expect(bolha).toBeVisible({ timeout: 20_000 });
      await expect(bolha).toContainText(MASK);
      await expect(pDono.locator("body")).not.toContainText("nove nove nove");
      expect(await pDono.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await pDono.screenshot({ path: `${SAIDA}/t1655-dono-${vez}-390.png` });
    }
    // Print de conferência a 1280 (a tela larga mostra lista e conversa lado a lado).
    await pDono.setViewportSize({ width: 1280, height: 900 });
    await expect(pDono.locator("section").getByText(/meu número é/)).toContainText(MASK);
    await pDono.screenshot({ path: `${SAIDA}/t1655-dono-1280.png` });
    await pDono.context().close();
  });
});
