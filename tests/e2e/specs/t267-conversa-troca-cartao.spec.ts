import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T267 — Defeito do QA (21/10, "cartão residual nas Conversas"): ao trocar de conversa, o cartão da visita da conversa
 * ANTERIOR não pode ficar na tela. Duas conversas do mesmo morador com o mesmo dono, em imóveis diferentes; só a do
 * imóvel A tem visita presencial confirmada. A ↔ B ↔ A, a 1280 e a 390 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t267.${sufixo}@lab.vivanomads.test`, nome: "Dora Conversas", role: "owner" as const };
const morador = { email: `mor.t267.${sufixo}@lab.vivanomads.test`, nome: "Mauro Conversas", role: "tenant" as const };
const ids: { dono?: string; morador?: string; a?: string; b?: string } = {};

async function abrirConversa(page: Page, id: string, largura: number) {
  if (largura === 390 && (await page.getByLabel("Voltar para a lista").isVisible())) await page.getByLabel("Voltar para a lista").click();
  await page.locator(`[data-testid="mensagens-conversa"][data-conversa="${id}"]`).click();
}

test.describe("T267 — troca de conversa não deixa o cartão da anterior", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.a = await criarImovelPronto(ids.dono, `Studio A ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, `Studio B ${sufixo}`, { ativo: true });
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    const { error } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.a, owner_id: ids.dono, tenant_id: ids.morador, horarios: [amanha], modalidade: "presencial", status: "confirmado", horario_confirmado: amanha });
    if (error) throw error;
    await gravarMensagem(ids.morador, ids.dono, ids.a, "Oi! Sobre o Studio A.", conversationId(ids.morador, ids.dono, ids.a));
    await gravarMensagem(ids.morador, ids.dono, ids.b, "Oi! Sobre o Studio B.", conversationId(ids.morador, ids.dono, ids.b));
  });

  test.afterAll(async () => {
    await adm().from("visitas_video").delete().in("property_id", [ids.a, ids.b].filter(Boolean) as string[]);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390]) {
    test(`A (com visita) → B (sem) → A, ${largura} px`, async ({ browser }) => {
      test.setTimeout(90_000);
      const page = await entrar(browser, morador.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      page.on("dialog", (d) => {
        throw new Error(`diálogo do navegador não permitido: ${d.message()}`);
      });
      await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
      const convA = conversationId(ids.morador!, ids.dono!, ids.a!);
      const convB = conversationId(ids.morador!, ids.dono!, ids.b!);

      await abrirConversa(page, convA, largura);
      const cartao = page.getByTestId("conversa-visita");
      await expect(cartao).toHaveAttribute("data-imovel", ids.a!, { timeout: 20_000 });
      await expect(cartao.getByTestId("cartao-visita")).toHaveAttribute("data-status", "confirmado");

      await abrirConversa(page, convB, largura);
      await expect(page.getByText("Oi! Sobre o Studio B.")).toBeVisible();
      await expect(page.getByTestId("conversa-visita"), "o cartão da conversa A não fica na B").toHaveCount(0);
      // E continua sem cartão depois que a resposta do servidor chega.
      await page.waitForTimeout(1500);
      await expect(page.getByTestId("conversa-visita")).toHaveCount(0);

      await abrirConversa(page, convA, largura);
      await expect(page.getByTestId("conversa-visita")).toHaveAttribute("data-imovel", ids.a!, { timeout: 20_000 });
      await page.context().close();
    });
  }
});
