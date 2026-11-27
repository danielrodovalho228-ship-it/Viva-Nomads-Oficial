import { test, expect, type Page, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { DOCUMENTO_BLOQUEADO } from "../../../src/lib/messages/contact-guard";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2224 — E1059, a perna de SERVIDOR (linha Mensagens; auditoria de travas da ORDEM-DUET-429). RASCUNHO.
  As travas da main cobrem a regra (e1059-cpf-recusado.test.ts), a tela que mostra a recusa do servidor
  (e1059-aviso-na-recusa.test.ts, pelo código-fonte) e a recusa pela TELA (t2204, E1057). Nenhuma passa pelo servidor:
  a tela recusa antes de enviar, por isso o `if (documento)` de sendMessage (src/lib/data/actions.ts) nunca é exercido.
  Aqui o envio chega ao servidor sem passar pela verificação da tela:
   1. Server Action: um envio normal pela tela é capturado e repetido com o texto trocado por cada documento (a frase da
      prova de 20/11, com DV inválido, e os formatos da t2204). O servidor responde com a frase do Ocupantes, nada é
      gravado e a outra parte não recebe aviso nem e-mail. Controle: o mesmo pedido com texto limpo grava.
   2. Banco: a mesma conta, com a sua sessão e a chave pública, tenta gravar direto na tabela `messages` cada uma das
      mesmas 5 formas. A recusa tem de valer também aqui, sem máscara (ORDEM-DUET-433/440). Controle: texto limpo entra.
  Só contas de teste. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2224.${sufixo}@lab.vivanomads.test`, nome: "Dora Servidor", role: "owner" as const };
const inq = { email: `inq.t2224.${sufixo}@lab.vivanomads.test`, nome: "Iara Servidor", role: "tenant" as const };
const ids: Record<string, string> = {};
const TITULO = `Studio servidor sem documento ${sufixo}`;
const LIMPO = `Posso visitar sabado ${sufixo}`;
const DOCUMENTOS = [
  { nome: "a frase da prova de 20/11 (CPF com DV inválido)", texto: "Meu CPF é 123.456.789-00 para o cadastro." },
  { nome: "CPF com máscara", texto: "meu CPF é 529.982.247-25" },
  { nome: "CPF sem máscara", texto: "cpf 52998224725 para o contrato" },
  { nome: "RG com prefixo de UF", texto: "RG MG-12.345.678 da minha esposa" },
  { nome: "RG pelo rótulo", texto: "identidade nº 12345678 ok?" },
] as const;

async function gravadasDoInq(): Promise<number> {
  const { count } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("sender_id", ids.inq).eq("property_id", ids.imovel);
  return count ?? 0;
}
async function comDocumento(): Promise<number> {
  const { data } = await adm().from("messages").select("body").eq("sender_id", ids.inq).eq("property_id", ids.imovel);
  return (data ?? []).filter((m) => /123\.456\.789|529\.982|52998224725|12\.345\.678|12345678/.test(String(m.body))).length;
}
async function avisosEEmailsDoDono(): Promise<number> {
  const a = await adm().from("avisos").select("id", { count: "exact", head: true }).eq("usuario_id", ids.dono).eq("evento", "new_message");
  const e = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", ids.dono).eq("evento", "new_message");
  return (a.count ?? 0) + (e.count ?? 0);
}
async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const conversa = page.getByRole("button", { name: new RegExp(TITULO) }).first();
  await expect(conversa).toBeVisible({ timeout: 30_000 });
  await conversa.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T2224 — E1059: o servidor recusa CPF/RG mesmo quando o envio não passa pela tela @E1059", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! Pode perguntar por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. Server Action: o envio repetido com cada documento é recusado pelo servidor; nada gravado, nada avisado", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrir(p);
    // Um envio normal pela tela, para capturar o pedido real da Server Action (cabeçalhos e corpo).
    const pedido = p.waitForRequest((r: Request) => r.method() === "POST" && !!r.headers()["next-action"] && (r.postData() ?? "").includes(LIMPO), { timeout: 20_000 });
    const antes = await gravadasDoInq();
    await p.getByTestId("mensagem-campo").fill(LIMPO);
    await p.getByRole("button", { name: "Enviar", exact: true }).click();
    const r = await pedido;
    await expect.poll(gravadasDoInq, { timeout: 20_000, message: "o envio normal grava (é o pedido que se vai repetir)" }).toBe(antes + 1);
    const cabecalhos = Object.fromEntries(Object.entries(r.headers()).filter(([k]) => !["content-length", "cookie", "host"].includes(k.toLowerCase())));
    const corpo = r.postData() ?? "";

    await p.waitForTimeout(3_000);
    const [gravadas, avisos] = [await gravadasDoInq(), await avisosEEmailsDoDono()];
    for (const d of DOCUMENTOS) {
      const resp = await p.request.post(r.url(), { headers: cabecalhos, data: corpo.replace(LIMPO, `${d.texto} ${sufixo}`) });
      const texto = await resp.text();
      expect.soft(texto, `${d.nome}: o servidor responde com a frase do Ocupantes`).toContain(DOCUMENTO_BLOQUEADO);
    }
    await p.waitForTimeout(3_000);
    expect(await gravadasDoInq(), "nenhum envio com documento foi gravado pelo servidor").toBe(gravadas);
    expect(await comDocumento(), "nenhuma mensagem com documento no banco").toBe(0);
    expect(await avisosEEmailsDoDono(), "o dono não recebe aviso nem e-mail de mensagem nova").toBe(avisos);

    // Controle: o mesmo pedido, com outro texto limpo, grava (a recusa vem do documento, não da repetição).
    const resp = await p.request.post(r.url(), { headers: cabecalhos, data: corpo.replace(LIMPO, `Outra pergunta ${sufixo}`) });
    expect(resp.ok(), "o pedido repetido com texto limpo é aceite").toBe(true);
    await expect.poll(gravadasDoInq, { timeout: 20_000, message: "controle: o texto limpo repetido grava" }).toBe(gravadas + 1);
    await p.context().close();
  });

  test("2. Banco: a conta, com a sua sessão, não grava nenhuma das 5 formas de documento direto na tabela messages", async () => {
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: inq.email, password: senha });
    expect(eLogin, "a conta de teste entra").toBeNull();
    // ORDEM-DUET-440: a recusa no banco cobre as mesmas 5 formas que a Server Action recusa (CPF/RG formatados e
    // rotulados). Achado da 1.ª corrida (lab 44998017135): o CPF ficava gravado MASCARADO pelo gatilho
    // messages_mask_contact (0057), como telefone; o RG nem isso — passava em claro.
    for (const d of DOCUMENTOS) {
      const marca = `${sufixo}-${DOCUMENTOS.indexOf(d)}`;
      const antes = await gravadasDoInq();
      const { error } = await c.from("messages").insert({
        conversation_id: conversationId(ids.inq, ids.dono, ids.imovel),
        sender_id: ids.inq,
        receiver_id: ids.dono,
        property_id: ids.imovel,
        body: `${d.texto} ${marca}`,
      });
      const { data: ficou } = await adm().from("messages").select("body").eq("sender_id", ids.inq).eq("property_id", ids.imovel).like("body", `%${marca}%`);
      expect.soft(await gravadasDoInq(), `${d.nome}: o banco não grava, nem mascarada (gravado: ${JSON.stringify((ficou ?? []).map((m) => m.body))}; erro do banco: ${error?.message ?? "nenhum"})`).toBe(antes);
    }
    // Controle: o banco continua a aceitar uma mensagem limpa pela mesma porta (a recusa vem do documento).
    const antes = await gravadasDoInq();
    const { error: eLimpo } = await c.from("messages").insert({ conversation_id: conversationId(ids.inq, ids.dono, ids.imovel), sender_id: ids.inq, receiver_id: ids.dono, property_id: ids.imovel, body: `Combinamos sexta ${sufixo}` });
    expect(eLimpo, "controle: a mensagem limpa entra pela inserção directa").toBeNull();
    expect(await gravadasDoInq()).toBe(antes + 1);
  });
});
