import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";

/**
 * T1656 — E963: "me chama no zap" SEM número abre o aviso do E585 ao digitar; a prévia é o texto inteiro, Enter não
 * envia, e só "Enviar mesmo assim" grava (com o texto igual). 390 e 1280. Só no laboratório (cria contas, entra e envia).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e963.${sufixo}@lab.vivanomads.test`, nome: "Dina Dona", role: "owner" as const };
const inq = { email: `inq.e963.${sufixo}@lab.vivanomads.test`, nome: "Ivan Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const TEXTO = "me chama no zap";

test.describe("T1656 — @E963 mensageiro citado sem número abre o aviso", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio E963 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel, false);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Oi! Pode perguntar o que quiser.", conversationId(ids.dono, ids.inq, ids.imovel));
  });
  test.afterAll(async () => {
    if (ids.dono && ids.inq) await adm().from("messages").delete().in("sender_id", [ids.dono, ids.inq]);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`'${TEXTO}': aviso ao digitar, Enter não envia, 'Enviar mesmo assim' grava igual (${largura} px)`, async ({ browser }) => {
      test.setTimeout(120_000);
      const conversa = conversationId(ids.dono!, ids.inq!, ids.imovel!);
      const doInquilino = async () => ((await adm().from("messages").select("body").eq("conversation_id", conversa).eq("sender_id", ids.inq!)).data ?? []).map((l) => l.body as string);
      const antes = (await doInquilino()).length;
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/mensagens?conversa=${conversa}`, { waitUntil: "domcontentloaded" });
      const campo = page.getByPlaceholder("Escreva uma mensagem...");
      await expect(campo).toBeVisible({ timeout: 20_000 });
      await campo.fill(TEXTO);
      await expect(page.getByTestId("aviso-antes-de-enviar")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("aviso-previa")).toHaveText(TEXTO);
      await campo.press("Enter");
      await page.waitForTimeout(1_500);
      expect((await doInquilino()).length).toBe(antes);
      await page.screenshot({ path: `${SAIDA}/t1656-e963-aviso-${largura}.png` });
      await page.getByRole("button", { name: "Enviar mesmo assim" }).click();
      await expect.poll(async () => (await doInquilino()).length, { timeout: 15_000 }).toBe(antes + 1);
      expect((await doInquilino()).at(-1)).toBe(TEXTO);
      await page.context().close();
    });
  }
});
