import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1078 — E533 (#2401, 04/11): sino com "Marcar todas como lidas", conversa lida baixa o aviso e a leitura velha não
 * desfaz a marcação. Pela tela real, morador, 390 e 1280:
 *   1. sino: 3 avisos não lidos → "3"; o painel → "Marcar todas como lidas" → o número some, o banco grava lido_em nos 3,
 *      e recarregar não traz o número de volta;
 *   2. lista (/dashboard/notificacoes#avisos): a gravação FALHA (simulada: o POST de /api/painel/avisos responde 500) →
 *      "Não foi possível marcar os avisos agora…" e nada fica lido no banco; sem a falha, o botão marca todos e some;
 *   3. aviso de "mensagem nova" de uma conversa: abrir a conversa em Mensagens marca o aviso como lido.
 * A versão que barra a leitura velha e as regras ficam com o e533-sino.test.ts; o sino e a faixa, com a t830.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t1078.${sufixo}@lab.vivanomads.test`, nome: "Lia Lidas Prado", role: "tenant" as const };
const dono = { email: `dono.t1078.${sufixo}@lab.vivanomads.test`, nome: "Saulo Sino Reis", role: "owner" as const };
const TITULO = `Studio do sino t1078 ${sufixo}`;
const ids: Record<string, string> = {};
const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const topo = (p: Page, w: number) => (w === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-morador"));
const px = (w: number) => (w === 390 ? "morador-celular" : "morador");
const naoLidos = async () =>
  (await adm().from("avisos").select("id", { count: "exact", head: true }).eq("usuario_id", ids.morador).is("lido_em", null)).count ?? 0;

async function semear(n: number) {
  await adm().from("avisos").delete().eq("usuario_id", ids.morador);
  const linhas = Array.from({ length: n }, (_, i) => ({
    usuario_id: ids.morador, evento: "dica", prioridade: "normal", titulo: `Aviso t1078 ${i + 1}`, url: "/dashboard", criado_em: horas(i + 1),
  }));
  const { error } = await adm().from("avisos").insert(linhas);
  if (error) throw error;
}

test.describe("T1078 — E533: marcar todas como lidas e a conversa lida baixa o aviso", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("avisos").delete().eq("usuario_id", ids.morador ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`sino marca todas; a lista avisa a falha e depois marca; a conversa aberta baixa o aviso (${w})`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      // 1. Sino.
      await semear(3);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const contagem = topo(p, w).getByTestId(`sino-${px(w)}-contagem`);
      await expect(contagem).toHaveText("3", { timeout: 30_000 });
      await topo(p, w).getByTestId(`sino-${px(w)}`).click();
      await topo(p, w).getByTestId(`sino-${px(w)}-marcar-todas`).click();
      await expect(contagem).toHaveCount(0, { timeout: 15_000 });
      await expect.poll(naoLidos, { timeout: 15_000 }).toBe(0);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(topo(p, w).getByTestId(`sino-${px(w)}`)).toBeVisible({ timeout: 30_000 });
      await p.waitForTimeout(1500);
      await expect(contagem, "recarregar não traz o número de volta").toHaveCount(0);

      // 2. Lista: a falha avisa e não marca; depois marca.
      await semear(3);
      await p.route("**/api/painel/avisos", (r) =>
        r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: '{"ok":false}' }) : r.fallback()
      );
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      const botao = p.getByTestId("avisos-marcar-todas");
      await expect(botao).toBeVisible({ timeout: 30_000 });
      await botao.click();
      await expect(p.getByTestId("avisos-marcar-todas-falha")).toHaveText("Não foi possível marcar os avisos agora. Tente de novo em instantes.", { timeout: 15_000 });
      await expect(botao, "a falha devolve o botão").toBeVisible();
      expect(await naoLidos(), "a falha não marca nada").toBe(3);
      await p.unrouteAll({ behavior: "wait" });
      await botao.click();
      await expect(botao).toHaveCount(0, { timeout: 15_000 });
      await expect(p.getByTestId("avisos-marcar-todas-falha")).toHaveCount(0);
      await expect.poll(naoLidos, { timeout: 15_000 }).toBe(0);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);

      // 3. A conversa aberta baixa o aviso de "mensagem nova" dela.
      await adm().from("avisos").delete().eq("usuario_id", ids.morador);
      await adm().from("messages").delete().eq("property_id", ids.imovel);
      const conversa = conversationId(ids.morador, ids.dono, ids.imovel);
      await gravarMensagem(ids.dono, ids.morador, ids.imovel, `Oi, o studio segue disponível (t1078 ${w}).`, conversa);
      const { data: aviso, error } = await adm()
        .from("avisos")
        .insert({ usuario_id: ids.morador, evento: "new_message", prioridade: "urgente", titulo: "Você recebeu uma mensagem", url: "/dashboard/mensagens", ref_id: conversa })
        .select("id")
        .single();
      if (error) throw error;
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      const item = p.getByRole("button", { name: new RegExp(TITULO) }).first();
      await expect(item).toBeVisible({ timeout: 30_000 });
      await item.click();
      await expect(p.getByTestId("mensagem-campo")).toBeVisible();
      await expect
        .poll(async () => ((await adm().from("avisos").select("lido_em").eq("id", aviso.id).single()).data as { lido_em: string | null }).lido_em, { timeout: 20_000 })
        .not.toBeNull();
      await p.context().close();
    });
  }
});
