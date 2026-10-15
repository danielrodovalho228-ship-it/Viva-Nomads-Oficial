import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T87 — "Denunciar mensagem suspeita" (ordem 404cd213, item 3): quem participa da conversa denuncia a 390 px;
 * vira chamado de segurança P1 (fila antifraude) com o id da conversa; um terceiro não denuncia conversa alheia.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.den.${sufixo}@lab.vivanomads.test`, nome: "Dora Denunciada", role: "owner" as const };
const inq = { email: `inq.den.${sufixo}@lab.vivanomads.test`, nome: "Iara Denunciante", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; conversa?: string } = {};

test.describe("T87 — denunciar mensagem suspeita", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da denúncia ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    ids.conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pague o sinal por fora para garantir.", ids.conversa);
  });

  test.afterAll(async () => {
    await adm().from("chamados").delete().eq("usuario_id", ids.inq ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o inquilino denuncia: aparece o aviso e nasce um chamado de segurança P1 com o id da conversa", async ({ browser }) => {
    test.setTimeout(120_000);
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await pagina.getByTestId("mensagens-conversa").first().click();
    await pagina.getByTestId("denunciar-abrir").click();
    await pagina.getByTestId("denunciar-nota").fill("Pediu pagamento por fora.");
    await pagina.getByTestId("denunciar-enviar").click();
    await expect(pagina.getByTestId("denuncia-enviada")).toBeVisible({ timeout: 20_000 });
    await expect(pagina.getByTestId("denuncia-enviada")).toContainText(/Recebemos sua denúncia/);

    const { data } = await adm().from("chamados").select("id, categoria, tipo, prioridade").eq("usuario_id", ids.inq!);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ categoria: "seguranca", tipo: "seguranca", prioridade: "p1" });
    const { data: msgs } = await adm().from("chamado_mensagens").select("corpo").eq("chamado_id", data![0].id).eq("autor", "usuario");
    expect(msgs?.[0]?.corpo).toContain(ids.conversa!);
    await pagina.context().close();
  });
});
