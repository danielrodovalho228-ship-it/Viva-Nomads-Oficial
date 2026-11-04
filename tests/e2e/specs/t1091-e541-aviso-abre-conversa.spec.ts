import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1091 — E541, o resto (#2455, 04/11): o aviso "Nova mensagem recebida" abre a conversa CERTA — antes, sino, lista de
 * avisos, push e e-mail levavam a /dashboard/mensagens sem a conversa e caíam na primeira da lista. Pela tela real, a
 * moradora com duas conversas (Ana, a mais recente, no studio A; Bruno, a mais antiga, no studio B), 390 e 1280:
 *   1. um aviso gravado ANTES da correção (url "/dashboard/mensagens", ref_id = a conversa do Bruno): o clique no sino
 *      abre ?conversa=<a do Bruno>, com o Bruno e o studio B — não a primeira da lista (a da Ana);
 *   2. o mesmo pela lista de avisos (/dashboard/notificacoes#avisos);
 *   3. o Bruno responde pela tela: o aviso novo da moradora já nasce com ?conversa=<a do Bruno>.
 * O endereço (urlDaConversa, urlDoAvisoComConversa) fica com o url-conversa.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t1091.${sufixo}@lab.vivanomads.test`, nome: "Marta Mensagem Reis", role: "tenant" as const };
const ana = { email: `ana.t1091.${sufixo}@lab.vivanomads.test`, nome: "Ana Aviso Prado", role: "owner" as const };
const bruno = { email: `bruno.t1091.${sufixo}@lab.vivanomads.test`, nome: "Bruno Bilhete Lopes", role: "owner" as const };
const T_A = `Studio A do aviso t1091 ${sufixo}`;
const T_B = `Studio B do aviso t1091 ${sufixo}`;
const ids: Record<string, string> = {};
const convB = () => conversationId(ids.mor, ids.bruno, ids.imB);

const topo = (p: Page, w: number) => (w === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-morador"));
const px = (w: number) => (w === 390 ? "morador-celular" : "morador");

async function avisoAntigo() {
  await adm().from("avisos").delete().eq("usuario_id", ids.mor);
  const { error } = await adm()
    .from("avisos")
    .insert({ usuario_id: ids.mor, evento: "new_message", prioridade: "urgente", titulo: `Nova mensagem de Bruno t1091`, url: "/dashboard/mensagens", ref_id: convB() });
  if (error) throw error;
}

async function naConversaDoBruno(p: Page) {
  await expect(p).toHaveURL(new RegExp(`/dashboard/mensagens\\?conversa=${convB()}`), { timeout: 30_000 });
  await expect(p.getByTestId("conversa-nome")).toContainText("Bruno", { timeout: 30_000 });
  await expect(p.getByTestId("conversa-contexto")).toContainText(T_B);
}

test.describe("T1091 — E541: o aviso de mensagem nova abre a conversa certa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.mor = await criarConta(mor, senha);
    ids.ana = await criarConta(ana, senha);
    ids.bruno = await criarConta(bruno, senha);
    ids.imA = await criarImovelPronto(ids.ana, T_A, { ativo: true });
    ids.imB = await criarImovelPronto(ids.bruno, T_B, { ativo: true });
    // O Bruno escreveu antes; a Ana, depois: a conversa da Ana é a primeira da lista.
    await gravarMensagem(ids.bruno, ids.mor, ids.imB, "Oi, o studio B segue livre.", convB());
    await new Promise((r) => setTimeout(r, 1200));
    await gravarMensagem(ids.ana, ids.mor, ids.imA, "Oi, o studio A também.", conversationId(ids.mor, ids.ana, ids.imA));
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("avisos").delete().eq("usuario_id", ids.mor ?? "");
    await adm().from("messages").delete().in("property_id", [ids.imA, ids.imB].filter(Boolean));
    await apagarContas([ids.mor, ids.ana, ids.bruno]);
  });

  for (const w of [390, 1280] as const) {
    test(`o aviso antigo abre a conversa do Bruno pelo sino e pela lista de avisos (${w})`, async ({ browser }) => {
      const p = await entrar(browser, mor.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      // 1. Sino.
      await avisoAntigo();
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await topo(p, w).getByTestId(`sino-${px(w)}`).click({ timeout: 30_000 });
      const painel = topo(p, w).getByTestId(`sino-${px(w)}-painel`);
      await painel.getByTestId("sino-aviso").filter({ hasText: "Nova mensagem de Bruno t1091" }).click({ timeout: 20_000 });
      await naConversaDoBruno(p);

      // 2. Lista de avisos.
      await avisoAntigo();
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      await p.getByTestId("avisos-item").filter({ hasText: "Nova mensagem de Bruno t1091" }).click({ timeout: 30_000 });
      await naConversaDoBruno(p);
      await p.context().close();
    });
  }

  test("3. o Bruno responde pela tela: o aviso novo já nasce com ?conversa=<a do Bruno>", async ({ browser }) => {
    await adm().from("avisos").delete().eq("usuario_id", ids.mor);
    const p = await entrar(browser, bruno.email, senha);
    await p.goto(`/dashboard/mensagens?conversa=${convB()}`, { waitUntil: "domcontentloaded" });
    const campo = p.getByTestId("mensagem-campo");
    await expect(campo).toBeVisible({ timeout: 30_000 });
    await campo.fill(`Pode vir visitar amanhã (t1091 ${sufixo}).`);
    await p.getByRole("button", { name: "Enviar" }).click();
    await expect
      .poll(
        async () =>
          ((await adm().from("avisos").select("url").eq("usuario_id", ids.mor).eq("evento", "new_message")).data ?? []).map((a) => (a as { url: string }).url),
        { timeout: 30_000 },
      )
      .toContain(`/dashboard/mensagens?conversa=${convB()}`);
    await p.context().close();
  });
});
