import { test, expect } from "@playwright/test";
import { hasAccount } from "../fixtures/accounts";

/**
 * T30 — Chat dos agentes: botão flutuante "ir para o fim" e conversa com rolagem própria.
 * Roda no projeto `app-mobile` (390x844, user-agent "VivaNomadsApp"). Usa a conversa com o
 * Moacir; para ter o que rolar, manda várias mensagens (o laboratório responde sem custo).
 */
test.describe("T30 — Chat: ir para o fim", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "app-mobile", "só no projeto app-mobile");
    test.skip(!hasAccount("admin"), "sem conta admin de teste");
  });

  test("abre no fim, mostra o botão ao subir (44px, com rótulo) e volta com um toque", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Conversar" }).click();
    const campo = page.getByLabel(/Mensagem para/);
    for (let i = 0; i < 6; i++) {
      await campo.fill(`Mensagem de teste ${i} para encher a conversa e gerar rolagem na lista de mensagens`);
      await page.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByTestId("digitando")).toHaveCount(0, { timeout: 30_000 });
    }
    const lista = page.getByTestId("lista-mensagens");
    const botao = page.getByRole("button", { name: "Ir para a última mensagem" });

    // No fim: sem botão; a rolagem é da lista, não da página.
    await expect(botao).toHaveCount(0);
    expect(await lista.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await lista.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(botao).toBeVisible();
    const caixa = await botao.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);

    await botao.click();
    await expect(botao).toHaveCount(0);
    expect(await lista.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 60)).toBe(true);
  });
});
