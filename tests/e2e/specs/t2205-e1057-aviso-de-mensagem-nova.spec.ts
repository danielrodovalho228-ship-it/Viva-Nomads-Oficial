import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2205 — E1057 (b), linha Mensagens (ORDEM-DUET-293). RASCUNHO: entra na vez das Mensagens.
  O aviso de mensagem nova ao DESTINATÁRIO (sendMessage → notify "new_message"): até aqui os e2e prendiam a tela e o
  banco (t11, t828), nunca o que sai para a outra parte. Este spec envia pela tela uma mensagem com contato (e
  "Enviar mesmo assim") e lê o que o dono recebe:
    - o e-mail na caixa de QA (emails_teste, conta de teste): o remetente pelo PRIMEIRO nome, o imóvel, a prévia com
      os marcadores, o link para responder na plataforma; nunca o telefone, o e-mail nem o sobrenome;
    - o aviso do sino (avisos, evento new_message): a prévia também mascarada (E482).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2205.${sufixo}@lab.vivanomads.test`, nome: "Dora Avisonovo", role: "owner" as const };
const inq = { email: `inq.t2205.${sufixo}@lab.vivanomads.test`, nome: "Iara Sobrenomesecreto", role: "tenant" as const };
const ids: Record<string, string> = {};
const TITULO = `Studio do aviso novo ${sufixo}`;
const MASK = "[contato protegido]";
const TELEFONE = "99876-5432";
const EMAIL_NA_MENSAGEM = `iara.${sufixo}@exemplo.com`;

/** O último e-mail new_message do dono na caixa de QA (com espera: o aviso sai depois da resposta). */
async function emailDoDono(): Promise<{ assunto: string; corpo: string }> {
  for (let i = 0; i < 40; i++) {
    const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.dono).eq("evento", "new_message").order("criado_em", { ascending: false }).limit(1);
    if (data?.[0]?.corpo) return { assunto: String(data[0].assunto ?? ""), corpo: String(data[0].corpo) };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("sem e-mail new_message do dono na caixa de QA");
}

async function avisoDoDono(): Promise<{ titulo: string; texto: string | null; url: string | null } | null> {
  const { data } = await adm().from("avisos").select("titulo, texto, url").eq("usuario_id", ids.dono).eq("evento", "new_message").order("criado_em", { ascending: false }).limit(1);
  return (data?.[0] as { titulo: string; texto: string | null; url: string | null } | undefined) ?? null;
}

async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const conversa = page.getByRole("button", { name: new RegExp(TITULO) }).first();
  await expect(conversa).toBeVisible({ timeout: 30_000 });
  await conversa.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T2205 — E1057 (b): o aviso de mensagem nova ao destinatário sai mascarado @E1057", () => {
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

  test("a mensagem com contato chega ao dono pelo e-mail e pelo sino só com os marcadores", async ({ browser }) => {
    // Um só envio: o e-mail tem limite de 1 por conversa a cada 30 min (o resto da rajada fica só no site).
    const p = await entrar(browser, inq.email, senha);
    await abrir(p);
    await p.getByTestId("mensagem-campo").fill(`Me chama no (34) ${TELEFONE} ou ${EMAIL_NA_MENSAGEM} ${sufixo}`);
    await p.getByRole("button", { name: "Enviar", exact: true }).click();
    await p.getByRole("button", { name: "Enviar mesmo assim" }).click();
    await expect(p.getByTestId("mensagem-campo")).toHaveValue("");
    // A página fica aberta até o aviso sair: o campo limpa já no eco otimista, e fechar o navegador antes da resposta do
    // servidor pode cortar o pedido a meio do notify() (ensaio 44815293069: sem e-mail na caixa).
    const { assunto, corpo } = await emailDoDono();
    await p.context().close();

    // Quem escreveu, pelo primeiro nome só; o imóvel da conversa (E267).
    expect(corpo).toContain("Iara");
    // O sobrenome nunca sai ("Remetente:" é o cabeçalho que a caixa de QA guarda, por isso o sobrenome é outro).
    expect(corpo).not.toContain("Sobrenomesecreto");
    expect(`${assunto}\n${corpo}`).toContain(TITULO);
    // A prévia leva os marcadores, nunca o contato.
    expect(corpo).toContain(MASK);
    expect(corpo).not.toContain(TELEFONE);
    expect(corpo).not.toContain(EMAIL_NA_MENSAGEM);
    // O caminho é a plataforma.
    expect(corpo).toMatch(/Responda pela plataforma|Responder no Viva Nomads/);

    await expect.poll(avisoDoDono, { timeout: 20_000 }).not.toBeNull();
    const aviso = (await avisoDoDono())!;
    expect(aviso.texto ?? "", "E482: a prévia do sino também mascarada").toContain(MASK);
    expect(aviso.texto ?? "").not.toContain(TELEFONE);
    expect(aviso.url ?? "", "o sino leva à conversa").toContain("/dashboard/mensagens");
  });
});
