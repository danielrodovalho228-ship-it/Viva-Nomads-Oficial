import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2086 (antes t2040, conversas) — Pista 3, lote 2, item F1 (conversas) @E482 @E444 (sem @ao-vivo-seguro: precisa de login e do laboratório). Regra: a mensagem nova gera o aviso da
  prioridade certa (new_message = URGENTE), com QUEM ESCREVEU no título, o IMÓVEL e a prévia limpa; um aviso pendente
  por conversa (a 2ª mensagem renova, não repete), e o sino mostra o selo "Urgente".
  Os eventos de orçamentos e de pré-aceite: prioridade pela mesma tabela (unitário e444-avisos); o pré-aceite está atrás
  da chave desligada. Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2040.${sufixo}@lab.vivanomads.test`, nome: "Dalia Prioridade", role: "owner" as const };
const inq = { email: `inq.t2040.${sufixo}@lab.vivanomads.test`, nome: "Otavio Prioridade", role: "tenant" as const };
const ids: Record<string, string> = {};
type Aviso = { evento: string; prioridade: string; titulo: string; texto: string | null; url: string; ref_id: string | null };
const avisosDoDono = async () => ((await adm().from("avisos").select("evento, prioridade, titulo, texto, url, ref_id").eq("usuario_id", ids.dono).eq("evento", "new_message")).data ?? []) as Aviso[];

test.describe("T2086 — F1: aviso de mensagem com prioridade, remetente e imóvel @E482", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Prioridade ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pode perguntar.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("avisos").delete().in("usuario_id", [ids.dono ?? "", ids.inq ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("duas mensagens do morador → um aviso urgente 'Nova mensagem de Otavio · imóvel' com a última prévia", async ({ browser }) => {
    const i = await entrar(browser, inq.email, senha);
    await i.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await i.getByRole("button", { name: new RegExp(`Studio Prioridade ${sufixo}`) }).first().click();
    for (const texto of [`Primeira pergunta ${sufixo}`, `Aceita pet de pequeno porte? ${sufixo}`]) {
      await i.getByTestId("mensagem-campo").fill(texto);
      await i.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect.poll(async () => ((await adm().from("messages").select("id").eq("sender_id", ids.inq).eq("body", texto)).data ?? []).length, { timeout: 20_000 }).toBe(1);
    }
    await i.context().close();

    await expect.poll(async () => (await avisosDoDono()).length, { timeout: 30_000 }).toBe(1);
    const [a] = await avisosDoDono();
    expect(a.prioridade).toBe("urgente");
    expect(a.titulo).toMatch(new RegExp(`^Nova mensagem de Otavio · Studio Prioridade ${sufixo}$`));
    expect(a.texto).toBe(`Aceita pet de pequeno porte? ${sufixo}`);
    expect(a.ref_id).toBe(conversationId(ids.inq, ids.dono, ids.imovel));
    expect(a.url).toBe(`/dashboard/mensagens?conversa=${a.ref_id}`);
    expect(a.titulo + (a.texto ?? "")).not.toContain(inq.email);

    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await d.getByTestId("topo-dono").getByTestId("sino-dono").click();
    const item = d.getByTestId("sino-dono-painel").getByTestId("sino-aviso").filter({ hasText: "Nova mensagem de Otavio" });
    await expect(item).toHaveCount(1, { timeout: 30_000 });
    await expect(item.getByTestId("aviso-texto")).toHaveText(`Aceita pet de pequeno porte? ${sufixo}`);
    await expect(item.getByTestId("aviso-prioridade")).toHaveAttribute("data-prioridade", "urgente");
    await expect(item.getByTestId("aviso-prioridade")).toHaveText("Urgente");
    await d.context().close();
  });
});
