import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T2203 — E1014 (instabilidade do t108): "Falar com uma pessoa" não se perde quando o dono toca antes de a página
  terminar de carregar.
  Causa (lab, 17/11): o t108 abre o chamado pelo chat da /ajuda/fale-com-a-viva. Com a máquina carregada, o toque chega
  antes do JavaScript da página: o botão ainda não tem ação e o toque some em silêncio — o formulário "Abrir chamado"
  nunca abre e o teste estoura o tempo esperando por ele (3 de 7 corridas).
  A montagem força esse instante: o JavaScript da página chega 4 s atrasado e o toque vem logo que o botão aparece.
  Regra: o toque abre o formulário do chamado mesmo assim (pela rota única do chat, ?doChat=1#abrir-chamado).
  390 e 1280 px.
*/
test.describe("T2203 — E1014: 'Falar com uma pessoa' antes do JavaScript da página abre o chamado @E1014", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ storageState: authFile("proprietario") });
  test.describe.configure({ timeout: 90_000 });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — toque antes do JavaScript abre o formulário do chamado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      // O JavaScript da página chega 4 s depois do HTML: o botão aparece antes de ter ação.
      let atrasar = true;
      await page.route("**/_next/static/chunks/**", async (route) => {
        if (atrasar) await new Promise((ok) => setTimeout(ok, 4_000));
        await route.continue().catch(() => {});
      });
      await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
      const botao = page.getByTestId("viva-chat-bloco").getByRole("button", { name: /Falar com uma pessoa/i });
      await expect(botao).toBeVisible({ timeout: 20_000 });
      await botao.click();
      atrasar = false; // daqui em diante a página carrega no ritmo normal
      await expect(page.locator("#abrir-chamado").getByLabel("O que aconteceu?"), "E1014: o toque abriu o formulário do chamado").toBeVisible({ timeout: 30_000 });
    });
  }
});
