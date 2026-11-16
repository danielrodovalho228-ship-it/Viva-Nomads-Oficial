import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2020 — Pista 3, lote 2, item A7 → E967 (Code 2) @E967 @E445 (sem @ao-vivo-seguro: precisa de login e do laboratório) — TRAVA NOMEADA da correção: vermelho esperado
  na main pela leitura do código: messages-client.tsx `enviar()` mostra o eco otimista e limpa o campo ANTES do servidor
  e ignora o retorno de `semQuedaDeRede(sendMessage(...))`, salvo o caso de ofensa).
  Regra: falha de rede no envio de mensagem → nem perde nem duplica: a pessoa vê que não foi, o texto não some, e
  tentar de novo grava UMA vez.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2020.${sufixo}@lab.vivanomads.test`, nome: "Dina Rede", role: "owner" as const };
const inq = { email: `inq.t2020.${sufixo}@lab.vivanomads.test`, nome: "Igor Rede", role: "tenant" as const };
const ids: Record<string, string> = {};
const TEXTO = `Chego na sexta, tudo certo? ${sufixo}`;
const gravadas = async () => ((await adm().from("messages").select("id").eq("sender_id", ids.inq).eq("body", TEXTO)).data ?? []).length;

test.describe("T2020 — E967: falha de rede no envio não perde nem duplica @E967", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da rede ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pode me escrever por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("rede cai no envio: aviso visível, texto preservado; de novo, grava uma vez só", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /Studio da rede/ }).first().click();
    // A ação do servidor (POST com o cabeçalho next-action) cai como se a internet tivesse caído.
    await p.route("**/dashboard/mensagens**", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort("internetdisconnected") : r.continue()));
    await p.getByTestId("mensagem-campo").fill(TEXTO);
    await p.getByRole("button", { name: "Enviar", exact: true }).click();

    // Não perde: a pessoa vê que não foi e o texto continua disponível (no campo ou na bolha com "tentar de novo").
    await expect(p.getByText(/A conexão caiu|não foi enviada|Tente de novo/i).first()).toBeVisible({ timeout: 15_000 });
    const noCampo = (await p.getByTestId("mensagem-campo").inputValue()) === TEXTO;
    const tentar = p.getByRole("button", { name: /Tentar de novo|Reenviar/i });
    expect(noCampo || (await tentar.count()) > 0, "o texto que não foi enviado não pode sumir").toBe(true);
    expect(await gravadas()).toBe(0);

    // Volta a rede: tentar de novo grava UMA vez; recarregando, a bolha aparece uma vez só.
    await p.unroute("**/dashboard/mensagens**");
    if (await tentar.count()) await tentar.first().click();
    else await p.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(gravadas, { timeout: 20_000 }).toBe(1);
    await p.reload({ waitUntil: "networkidle" });
    // Ajuste pedido no #3866 (Code 2): a 390 px a página recarregada reabre DIRETO na conversa (a URL guarda
    // ?conversa=, comportamento da main) e a lista fica escondida. Só volta à lista e clica se a conversa não abriu.
    const campo = p.getByTestId("mensagem-campo");
    const naLista = p.getByRole("button", { name: /Studio da rede/ }).first();
    await expect(campo.or(naLista).first()).toBeVisible({ timeout: 15_000 });
    if (!(await campo.isVisible())) await naLista.click();
    await expect(campo).toBeVisible({ timeout: 15_000 });
    // A bolha aparece UMA vez na conversa aberta (só o que está visível: a prévia da lista, escondida a 390 px, não conta).
    await expect(p.locator("main").getByText(TEXTO, { exact: true }).filter({ visible: true })).toHaveCount(1);
    expect(await gravadas()).toBe(1);
    await p.context().close();
  });
});
