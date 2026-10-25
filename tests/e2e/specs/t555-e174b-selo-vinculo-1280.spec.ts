import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T555 — E174-B (#1404), guarda permanente da Pista C, no que a t486 da Pista A não cobre: a candidatura e a conversa
  a 1280 px (a t486 abre as duas só a 390), e o e-mail do vínculo nunca na tela inteira (só o domínio, sem "@"):
   1. candidatura (/dashboard/leads): "Vínculo profissional · <domínio>" no cartão da candidata;
   2. conversa (/dashboard/mensagens): o mesmo selo no cabeçalho;
   3. o <main> das duas telas não tem "@<domínio>" nem o e-mail da candidata.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const DOMINIO = "clinica-lab.org.br";
const bia = { email: `bia.t555.${sufixo}@lab.vivanomads.test`, nome: "Bia Vinculo", role: "tenant" as const };
const dono = { email: `dono.t555.${sufixo}@lab.vivanomads.test`, nome: "Beto Vinculo", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T555 — E174-B: selo do vínculo na candidatura e na conversa a 1280 px", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.bia = await criarConta(bia, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Vínculo t555 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.bia, ids.imovel);
    await gravarMensagem(ids.bia, ids.dono, ids.imovel, "Olá! Tenho interesse no imóvel.", conversationId(ids.bia, ids.dono, ids.imovel));
    const { error } = await adm()
      .from("vinculo_profissional")
      .upsert({ user_id: ids.bia, dominio: DOMINIO, codigo_hash: "0".repeat(64), expira_em: new Date(Date.now() + 600_000).toISOString(), confirmado_em: new Date().toISOString() });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.bia, ids.dono]);
  });

  test("1280 px — candidatura e conversa com o selo, sem e-mail na tela", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    const sinais = p.getByTestId("candidato-sinais").first();
    await expect(sinais.getByTestId("selo-vinculo")).toHaveText(`Vínculo profissional · ${DOMINIO}`, { timeout: 20_000 });
    for (const proibido of [`@${DOMINIO}`, bia.email]) await expect(p.locator("main")).not.toContainText(proibido);
    await p.screenshot({ path: `${SAIDA}/t555-candidatura-1280.png`, fullPage: true });

    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: /Vínculo t555/ }).first().click();
    await expect(p.getByTestId("selo-vinculo").first()).toHaveText(`Vínculo profissional · ${DOMINIO}`, { timeout: 20_000 });
    for (const proibido of [`@${DOMINIO}`, bia.email]) await expect(p.locator("main")).not.toContainText(proibido);
    await p.screenshot({ path: `${SAIDA}/t555-conversa-1280.png` });
    await p.context().close();
  });
});
