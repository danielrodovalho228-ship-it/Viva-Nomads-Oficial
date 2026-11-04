import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1079 — E541 (#2402, 04/11): "Responder pela plataforma" (Interessados) abre a conversa DAQUELA candidatura — antes, a
 * caixa de Mensagens abria a primeira da lista, de outra pessoa. Pela tela real, proprietário com duas candidaturas
 * aceitas (Ana no studio A, a conversa mais recente; Bruno no studio B, a mais antiga), 390 e 1280:
 *   1. cada "Responder pela plataforma" aponta para /dashboard/mensagens?conversa=<a conversa daquele par e imóvel>;
 *   2. o do Bruno (que NÃO é a primeira conversa da lista) abre a conversa do Bruno, com o studio B no contexto;
 *   3. o da Ana abre a conversa da Ana.
 * A conversa por par e imóvel (conversationId em listLeads) fica com o e541-responder-conversa.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1079.${sufixo}@lab.vivanomads.test`, nome: "Rui Responde Matos", role: "owner" as const };
const ana = { email: `ana.t1079.${sufixo}@lab.vivanomads.test`, nome: "Ana Aurora Campos", role: "tenant" as const };
const bruno = { email: `bruno.t1079.${sufixo}@lab.vivanomads.test`, nome: "Bruno Brisa Teles", role: "tenant" as const };
const T_A = `Studio A da resposta t1079 ${sufixo}`;
const T_B = `Studio B da resposta t1079 ${sufixo}`;
const ids: Record<string, string> = {};
const esperado = () => ({
  ana: `/dashboard/mensagens?conversa=${conversationId(ids.ana, ids.dono, ids.imA)}`,
  bruno: `/dashboard/mensagens?conversa=${conversationId(ids.bruno, ids.dono, ids.imB)}`,
});

test.describe("T1079 — E541: Responder pela plataforma abre a conversa daquela candidatura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ana = await criarConta(ana, senha);
    ids.bruno = await criarConta(bruno, senha);
    ids.imA = await criarImovelPronto(ids.dono, T_A, { ativo: true, preco: 3000 });
    ids.imB = await criarImovelPronto(ids.dono, T_B, { ativo: true, preco: 3100 });
    await criarLead(ids.dono, ids.bruno, ids.imB, true);
    await criarLead(ids.dono, ids.ana, ids.imA, true);
    // O Bruno escreveu antes; a Ana, depois: a conversa da Ana é a primeira da lista.
    await gravarMensagem(ids.bruno, ids.dono, ids.imB, "Oi, sou o Bruno e quero o studio B.", conversationId(ids.bruno, ids.dono, ids.imB));
    await new Promise((r) => setTimeout(r, 1200));
    await gravarMensagem(ids.ana, ids.dono, ids.imA, "Oi, sou a Ana e quero o studio A.", conversationId(ids.ana, ids.dono, ids.imA));
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("messages").delete().in("property_id", [ids.imA, ids.imB].filter(Boolean));
    await apagarContas([ids.dono, ids.ana, ids.bruno]);
  });

  for (const w of [390, 1280] as const) {
    test(`cada Responder aponta para a sua conversa; o do Bruno não abre a da Ana (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const e = esperado();

      // 1. Os links.
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const botoes = p.getByTestId("responder-pela-plataforma");
      await expect(botoes).toHaveCount(2, { timeout: 30_000 });
      const hrefs = await botoes.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(new Set(hrefs)).toEqual(new Set([e.ana, e.bruno]));
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);

      // 2. O do Bruno abre a conversa do Bruno (não a primeira da lista, que é a da Ana).
      await p.locator(`[data-testid="responder-pela-plataforma"][href="${e.bruno}"]`).click();
      await expect(p).toHaveURL(new RegExp(`conversa=${conversationId(ids.bruno, ids.dono, ids.imB)}`), { timeout: 30_000 });
      await expect(p.getByTestId("conversa-nome")).toContainText("Bruno", { timeout: 30_000 });
      await expect(p.getByTestId("conversa-contexto")).toContainText(T_B);
      await expect(p.getByText("Oi, sou o Bruno e quero o studio B.")).toBeVisible();

      // 3. O da Ana abre a da Ana.
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await p.locator(`[data-testid="responder-pela-plataforma"][href="${e.ana}"]`).click({ timeout: 30_000 });
      await expect(p.getByTestId("conversa-nome")).toContainText("Ana", { timeout: 30_000 });
      await expect(p.getByTestId("conversa-contexto")).toContainText(T_A);
      await p.context().close();
    });
  }
});
