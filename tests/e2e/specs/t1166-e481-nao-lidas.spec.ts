import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1166 — E481 (#2635, 05/11): não lidas. O sino não baixava ao ler a conversa (a tela marcava lidas no servidor, mas o
 * sino só relia no ciclo de 1 minuto) e a lista de Mensagens não destacava as não lidas. O E481 entrou só com teste de
 * unidade; aqui é a tela, 390 e 1280. Para cada largura, o dono recebe mensagens de duas moradoras (2 e 1 não lidas), com
 * os avisos de mensagem nova da conversa (ref_id = conversa, como desde o E533):
 *   1. entrando pela conversa B (aberta = lida), a A segue na lista com data-nao-lidas="2" e o selo mensagens-nao-lidas;
 *   2. abrir a A zera a contagem dela na lista e o sino baixa 2 SEM recarregar (bem antes do ciclo de 1 minuto);
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1166.${sufixo}@lab.vivanomads.test`, nome: "Davi Naolidas", role: "owner" as const };
const inq = (w: number, k: "a" | "b") => ({ email: `inq.t1166.${w}${k}.${sufixo}@lab.vivanomads.test`, nome: `Moradora ${k.toUpperCase()}${w}`, role: "tenant" as const });
const ids: { dono?: string; imovel?: string; inq: Record<string, string> } = { inq: {} };

/** O número do sino pelo nome acessível do botão ("Notificações: N não lidas"; sem não lidas, só "Notificações"). */
async function noSino(page: Page): Promise<number> {
  const sino = page.locator('button[data-testid^="sino-"][aria-label^="Notificações"]:visible').first();
  await expect(sino).toBeVisible({ timeout: 20_000 });
  return Number((await sino.getAttribute("aria-label"))?.match(/(\d+) não lidas/)?.[1] ?? 0);
}

/** No celular a conversa aberta ocupa a tela (a lista fica escondida): volta para a lista antes de ler o sino ou clicar. */
async function voltarParaLista(page: Page) {
  const voltar = page.getByRole("button", { name: "Voltar para a lista" });
  if (await voltar.isVisible().catch(() => false)) await voltar.click();
}

test.describe("T1166 — E481: ler a conversa baixa o sino na hora e a lista destaca as não lidas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio não lidas ${sufixo}`, { ativo: true });
    for (const w of [390, 1280]) for (const k of ["a", "b"] as const) {
      const id = await criarConta(inq(w, k), senha);
      ids.inq[`${w}${k}`] = id;
      await criarLead(ids.dono, id, ids.imovel, true);
    }
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("avisos").delete().eq("usuario_id", ids.dono);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([...Object.values(ids.inq), ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a conversa lida zera na lista e o sino baixa sem recarregar (${w})`, async ({ browser }) => {
      const conv = { a: conversationId(ids.dono!, ids.inq[`${w}a`], ids.imovel!), b: conversationId(ids.dono!, ids.inq[`${w}b`], ids.imovel!) };
      for (const [k, n] of [["b", 1], ["a", 2]] as const) {
        for (let i = 0; i < n; i++) {
          await gravarMensagem(ids.inq[`${w}${k}`], ids.dono!, ids.imovel!, `Mensagem ${k}${i} ${sufixo}`, conv[k]);
          const { error } = await adm().from("avisos").insert({ usuario_id: ids.dono, evento: "new_message", prioridade: "normal", titulo: `Nova mensagem de Moradora ${k.toUpperCase()}${w}`, url: `/dashboard/mensagens?conversa=${conv[k]}`, ref_id: conv[k] });
          expect(error, error?.message).toBeNull();
        }
      }

      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        // Sem ?conversa a tela abre a 1ª da lista (a de atividade mais recente, a A) e já a marca lida: entra pela B,
        // que fica aberta (e lida), e a A segue com as 2 não lidas até o clique.
        await p.goto(`/dashboard/mensagens?conversa=${conv.b}`, { waitUntil: "domcontentloaded" });
        const item = (id: string) => p.locator(`[data-testid="mensagens-conversa"][data-conversa="${id}"]`);
        await expect(item(conv.a)).toHaveAttribute("data-nao-lidas", "2", { timeout: 30_000 });
        await expect(item(conv.a).getByTestId("mensagens-nao-lidas")).toHaveText("2");
        await expect(item(conv.b)).toHaveAttribute("data-nao-lidas", "0", { timeout: 15_000 });
        await voltarParaLista(p);
        // O sino assenta depois da leitura da B (relê pelo evento dos contadores): lê duas vezes iguais antes de medir.
        let antes = -1;
        await expect(async () => {
          const um = await noSino(p);
          await p.waitForTimeout(1_500);
          expect(await noSino(p)).toBe(um);
          antes = um;
        }).toPass({ timeout: 20_000 });
        expect(antes, "o sino ainda conta os 2 avisos da A").toBeGreaterThanOrEqual(2);

        await item(conv.a).click();
        await expect(item(conv.a)).toHaveAttribute("data-nao-lidas", "0", { timeout: 15_000 });
        await expect(item(conv.a).getByTestId("mensagens-nao-lidas")).toHaveCount(0);
        await voltarParaLista(p);
        // Sem recarregar: o sino relê pelo evento dos contadores, bem antes do ciclo de 1 minuto.
        await expect.poll(() => noSino(p), { timeout: 20_000, message: "o sino baixa 2 ao ler a conversa" }).toBe(antes - 2);
        await expect(item(conv.b)).toHaveAttribute("data-nao-lidas", "0");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
