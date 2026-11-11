import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1600 — E721 (devolução do QA, 10/11, rodada 11:50): "permissão de coluna da 0336 barra o upsert". Caminho REAL, com
  Postgres + PostgREST + RLS do laboratório e a 0336 aplicada:
    1. adiar (primeira vez → INSERT) · 2. adiar de novo (linha antiga vencida → UPDATE só de adiada_em/ate)
    3. retomar (DELETE) · 4. retomar de novo (nada a apagar → sem erro)
  E o estado nos dois lados: o morador adia a SUA visão; o dono continua vendo a conversa em "Todas", sem linha dele.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1600.${sufixo}@lab.vivanomads.test`, nome: "Dalva Adia", role: "owner" as const };
const inq = { email: `inq.t1600.${sufixo}@lab.vivanomads.test`, nome: "Ivo Adia", role: "tenant" as const };
const ids: Record<string, string> = {};
const cid = () => conversationId(ids.inq, ids.dono, ids.imovel);

async function linha(userId: string) {
  const { data } = await adm().from("conversas_adiadas").select("adiada_em, ate").eq("user_id", userId).eq("conversation_id", cid()).maybeSingle();
  return data as { adiada_em: string; ate: string } | null;
}

async function abrirConversa(p: Page, filtro: "todas" | "adiadas" = "todas") {
  await p.goto(`/dashboard/mensagens?conversa=${cid()}`, { waitUntil: "domcontentloaded" });
  if (filtro === "adiadas") await p.getByTestId("mensagens-filtro-adiadas").click();
  const item = p.locator(`[data-testid="mensagens-conversa"][data-conversa="${cid()}"]`);
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
}

test.describe("T1600 — E721: adiar a conversa de ponta a ponta (sem 42P10, sem permissão negada)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do adiar ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Combinamos a visita por aqui.", cid());
  });
  test.afterAll(async () => {
    await adm().from("conversas_adiadas").delete().eq("conversation_id", cid());
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("adiar, adiar de novo, retomar e retomar de novo — e o outro lado não é afetado", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });

    // 1. Adiar pela primeira vez (INSERT).
    await abrirConversa(p);
    await p.getByTestId("conversa-adiar").click();
    await p.getByTestId("conversa-adiar-1d").click();
    await expect(p.getByTestId("conversa-adiar-erro")).toHaveCount(0);
    await expect.poll(async () => (await linha(ids.inq)) !== null, { timeout: 15_000 }).toBe(true);
    const primeira = (await linha(ids.inq))!;
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("mensagens-filtro-adiadas")).toContainText("1", { timeout: 30_000 });

    // 2. Adiar de novo com a linha já existente (vencida → a conversa voltou; o botão Adiar reaparece): UPDATE.
    await adm().from("conversas_adiadas").update({ ate: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", ids.inq).eq("conversation_id", cid());
    await abrirConversa(p);
    await p.getByTestId("conversa-adiar").click();
    await p.getByTestId("conversa-adiar-7d").click();
    await expect(p.getByTestId("conversa-adiar-erro")).toHaveCount(0);
    await expect.poll(async () => Date.parse((await linha(ids.inq))?.ate ?? "0") > Date.now() + 6 * 86_400_000, { timeout: 15_000 }).toBe(true);
    expect(Date.parse((await linha(ids.inq))!.adiada_em)).toBeGreaterThan(Date.parse(primeira.adiada_em));

    // O outro lado: o dono não tem linha e vê a conversa em "Todas".
    expect(await linha(ids.dono)).toBeNull();
    const d = await entrar(browser, dono.email, senha);
    await abrirConversa(d);
    await expect(d.getByTestId("conversa-adiar")).toBeVisible();
    await d.context().close();

    // 3. Retomar (DELETE).
    await abrirConversa(p, "adiadas");
    await p.getByTestId("conversa-retomar").click();
    await expect(p.getByTestId("conversa-adiar-erro")).toHaveCount(0);
    await expect.poll(async () => await linha(ids.inq), { timeout: 15_000 }).toBeNull();

    // 4. Retomar de novo, sem linha (tela antiga): sem erro.
    await adm().from("conversas_adiadas").insert({ user_id: ids.inq, conversation_id: cid(), adiada_em: new Date().toISOString(), ate: new Date(Date.now() + 86_400_000).toISOString() });
    await abrirConversa(p, "adiadas");
    await adm().from("conversas_adiadas").delete().eq("user_id", ids.inq).eq("conversation_id", cid());
    await p.getByTestId("conversa-retomar").click();
    await expect(p.getByTestId("conversa-adiar-erro")).toHaveCount(0);
    await p.context().close();
  });
});
