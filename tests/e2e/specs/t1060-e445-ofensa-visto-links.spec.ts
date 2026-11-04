import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1060 — E445 (#2367, Relay 57, itens 1, 3 e 4 — Pista B): mensagens. Pela tela real /dashboard/mensagens (390 e 1280)
  e pelo banco do laboratório (0287):
   1. item 3 — termo ofensivo: o servidor avisa ANTES de gravar ("aviso-ofensa"); "Revisar a mensagem" fecha o aviso com
      o texto no campo e nada gravado; "Enviar mesmo assim" grava e põe o registro na fila de moderação (quem, conversa,
      termo, a mensagem); a fila só o admin lê;
   2. item 4 — leitura: o dono abre a conversa → as mensagens que ELE recebeu ficam lidas; o morador vê "Visto" só na
      última mensagem dele; mensagens_nao_lidas() conta só as da própria pessoa; quem ENVIOU não marca a própria como
      lida, e ninguém muda o texto de uma mensagem (só a coluna lido_em, só o destinatário);
   3. item 1 — o gatilho do banco mascara TODO link externo e deixa passar só o site da Viva.
  O aviso de contato/link antes de enviar (#2366) fica com a t828; o som de mensagem nova (#2368), com a t829.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1060.${sufixo}@lab.vivanomads.test`, nome: "Dora Respeito Souza", role: "owner" as const };
const inq = { email: `inq.t1060.${sufixo}@lab.vivanomads.test`, nome: "Iara Respeito Lima", role: "tenant" as const };
const ids: Record<string, string> = {};
const AVISO = "Sua mensagem tem um termo ofensivo.";
const LINK = "🔒 [link protegido]";
let conversa = "";

async function sessao(email: string) {
  const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await cli.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return cli;
}
async function doInq(): Promise<{ id: string; body: string; lido_em: string | null }[]> {
  const { data } = await adm().from("messages").select("id, body, lido_em").eq("sender_id", ids.inq).eq("conversation_id", conversa).order("created_at");
  return (data ?? []) as { id: string; body: string; lido_em: string | null }[];
}
async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const c = page.getByRole("button", { name: /Studio do respeito/ }).first();
  await expect(c).toBeVisible({ timeout: 30_000 });
  await c.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T1060 — E445: ofensa avisada antes de gravar, Visto, e link externo mascarado no banco", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do respeito ${sufixo}`, { ativo: true });
    conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! Pode perguntar por aqui.", conversa);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("moderacao_ofensas").delete().eq("autor_id", ids.inq ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. termo ofensivo: aviso antes de gravar; Revisar não grava; Enviar mesmo assim grava e vai à fila (${w})`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(p);
      const campo = p.getByTestId("mensagem-campo");
      const aviso = p.getByTestId("aviso-ofensa");
      const antes = (await doInq()).length;
      const texto = `Seu corno, responde logo ${w} ${sufixo}`;

      await campo.fill(texto);
      await p.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      await expect(aviso).toContainText(AVISO);
      await expect(campo).toHaveValue(texto);
      expect((await doInq()).length, "o aviso vem ANTES de gravar").toBe(antes);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await aviso.getByRole("button", { name: "Revisar a mensagem" }).click();
      await expect(aviso).toHaveCount(0);
      await expect(campo).toHaveValue(texto);
      expect((await doInq()).length).toBe(antes);

      await p.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      await aviso.getByRole("button", { name: "Enviar mesmo assim" }).click();
      await expect(aviso).toHaveCount(0);
      await expect.poll(async () => (await doInq()).length, { timeout: 20_000 }).toBe(antes + 1);
      const gravada = (await doInq()).at(-1)!;
      expect(gravada.body).toContain(`responde logo ${w}`);
      await expect
        .poll(async () => (await adm().from("moderacao_ofensas").select("termo, conversation_id").eq("message_id", gravada.id)).data ?? [], { timeout: 20_000 })
        .toEqual([{ termo: "corno", conversation_id: conversa }]);
      await p.context().close();
    });
  }

  test("1b. a fila de moderação só o admin lê", async () => {
    for (const email of [inq.email, dono.email]) {
      const { data } = await (await sessao(email)).from("moderacao_ofensas").select("id").limit(5);
      expect(data ?? [], email).toHaveLength(0);
    }
  });

  test("2. o dono abre a conversa → lidas; o morador vê 'Visto' só na última; só o destinatário marca, e só lido_em", async ({ browser }) => {
    // Antes de o dono abrir: não lidas dele contam as mensagens do morador nesta conversa.
    const d = await sessao(dono.email);
    const nl = await d.rpc("mensagens_nao_lidas");
    expect(nl.error).toBeNull();
    const daConversa = ((nl.data ?? []) as { conversation_id: string; nao_lidas: number }[]).find((r) => r.conversation_id === conversa);
    expect(daConversa?.nao_lidas).toBe((await doInq()).length);

    // Quem ENVIOU não marca a própria mensagem como lida; ninguém troca o texto.
    const i = await sessao(inq.email);
    const primeira = (await doInq())[0];
    await i.from("messages").update({ lido_em: new Date().toISOString() }).eq("id", primeira.id);
    expect((await doInq())[0].lido_em, "o remetente não marca").toBeNull();
    const troca = await d.from("messages").update({ body: "trocado" }).eq("id", primeira.id);
    expect(troca.error, "nem o destinatário muda o texto").not.toBeNull();
    expect((await doInq())[0].body).toBe(primeira.body);

    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await abrir(pd);
    await expect.poll(async () => (await doInq()).every((m) => m.lido_em !== null), { timeout: 30_000 }).toBe(true);
    await pd.context().close();
    const nlDepois = await d.rpc("mensagens_nao_lidas");
    expect(((nlDepois.data ?? []) as { conversation_id: string }[]).some((r) => r.conversation_id === conversa)).toBe(false);

    for (const w of [390, 1280] as const) {
      const pi = await entrar(browser, inq.email, senha);
      await pi.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(pi);
      await expect(pi.getByTestId("mensagem-vista"), `${w}: "Visto" só na última mensagem do morador`).toHaveCount(1, { timeout: 20_000 });
      await pi.context().close();
    }
  });

  test("3. o gatilho do banco mascara todo link externo e deixa passar só o site da Viva", async () => {
    const corpo = `Veja https://exemplo.com.br/casa e bit.ly/abc123 e www.outro-site.net/x, ou https://vivanomads.com.br/imoveis ${sufixo}`;
    const { data, error } = await adm()
      .from("messages")
      .insert({ conversation_id: conversa, sender_id: ids.inq, receiver_id: ids.dono, property_id: ids.imovel, body: corpo })
      .select("body")
      .single();
    expect(error).toBeNull();
    const gravado = (data as { body: string }).body;
    expect(gravado).not.toMatch(/exemplo\.com\.br|bit\.ly|outro-site\.net/);
    expect(gravado.split(LINK).length - 1, "os três links externos mascarados").toBe(3);
    expect(gravado).toContain("https://vivanomads.com.br/imoveis");
  });
});
