import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2015 — Pista 3, lote 2, item A2 @E445 @E484 @ao-vivo-seguro. Regra: a conversa manda e recebe nos DOIS sentidos,
  as mensagens aparecem em ordem cronológica nas duas pontas, e o "Visto" aparece só na última mensagem minha que o
  outro lado já abriu (E445 item 4). Vermelho: pendente de laboratório (prova do Gerente no julgamento do merge).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2015.${sufixo}@lab.vivanomads.test`, nome: "Dalva Ordem", role: "owner" as const };
const inq = { email: `inq.t2015.${sufixo}@lab.vivanomads.test`, nome: "Ivo Ordem", role: "tenant" as const };
const ids: Record<string, string> = {};
const M = [`1 · olá, o studio está livre? ${sufixo}`, `2 · posso entrar dia 10? ${sufixo}`, `3 · pode sim, dia 10 está livre ${sufixo}`, `4 · combinado, obrigado ${sufixo}`];

async function abrir(p: Page) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(`Studio da ordem ${sufixo}`) }).first().click();
  await expect(p.getByTestId("mensagem-campo")).toBeVisible();
}
async function enviar(p: Page, texto: string) {
  await p.getByTestId("mensagem-campo").fill(texto);
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
}
/** Posição de cada mensagem no texto da conversa aberta (−1 = não está). */
async function posicoes(p: Page, textos: string[]) {
  const t = await p.locator("main").innerText();
  return textos.map((x) => t.lastIndexOf(x));
}
const noBanco = async () => ((await adm().from("messages").select("body, sender_id, created_at").eq("property_id", ids.imovel).order("created_at")).data ?? []) as { body: string; sender_id: string }[];

test.describe("T2015 — A2: os dois sentidos, ordem cronológica e Visto @E445", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da ordem ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, M[0], conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("avisos").delete().in("usuario_id", [ids.dono ?? "", ids.inq ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("morador → dono → morador: tudo chega, na ordem, e o Visto marca a última lida", async ({ browser }) => {
    // Morador manda a 2ª; ainda sem "Visto" (o dono não abriu).
    const i = await entrar(browser, inq.email, senha);
    await abrir(i);
    await enviar(i, M[1]);
    await expect.poll(async () => (await noBanco()).length, { timeout: 20_000 }).toBe(2);
    await i.reload({ waitUntil: "networkidle" });
    await i.getByRole("button", { name: new RegExp(`Studio da ordem ${sufixo}`) }).first().click();
    await expect(i.getByTestId("mensagem-vista")).toHaveCount(0);

    // Dono abre: recebe as duas, em ordem; responde.
    const d = await entrar(browser, dono.email, senha);
    await abrir(d);
    const [p0, p1] = await posicoes(d, [M[0], M[1]]);
    expect(p0).toBeGreaterThanOrEqual(0);
    expect(p1).toBeGreaterThan(p0);
    await enviar(d, M[2]);
    await expect.poll(async () => (await noBanco()).length, { timeout: 20_000 }).toBe(3);

    // Morador recarrega: a resposta chega depois das dele, e o "Visto" fica só na 2ª (a última dele, lida pelo dono).
    await i.reload({ waitUntil: "networkidle" });
    await i.getByRole("button", { name: new RegExp(`Studio da ordem ${sufixo}`) }).first().click();
    const [q0, q1, q2] = await posicoes(i, [M[0], M[1], M[2]]);
    expect(q0).toBeGreaterThanOrEqual(0);
    expect(q1).toBeGreaterThan(q0);
    expect(q2).toBeGreaterThan(q1);
    await expect(i.getByTestId("mensagem-vista")).toHaveCount(1);
    await expect(i.getByTestId("mensagem-vista")).toHaveText("Visto");
    await enviar(i, M[3]);
    await expect.poll(async () => (await noBanco()).length, { timeout: 20_000 }).toBe(4);

    // Banco: a ordem e os remetentes, sem duplicar nada.
    const linhas = await noBanco();
    expect(linhas.map((l) => l.body)).toEqual(M);
    expect(linhas.map((l) => l.sender_id)).toEqual([ids.inq, ids.inq, ids.dono, ids.inq]);

    // Dono recarrega: as 4, em ordem; o "Visto" dele fica na 3ª (o morador abriu depois dela).
    await d.reload({ waitUntil: "networkidle" });
    await d.getByRole("button", { name: new RegExp(`Studio da ordem ${sufixo}`) }).first().click();
    const pos = await posicoes(d, M);
    for (let k = 1; k < M.length; k++) expect(pos[k], `ordem da ${k + 1}ª`).toBeGreaterThan(pos[k - 1]);
    await expect(d.getByTestId("mensagem-vista")).toHaveCount(1);
    await i.context().close();
    await d.context().close();
  });
});
