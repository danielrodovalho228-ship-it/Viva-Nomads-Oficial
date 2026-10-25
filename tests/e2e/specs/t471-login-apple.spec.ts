import { test, expect } from "@playwright/test";

/**
 * T471 — LOGIN-APPLE (preparado, NÃO ligado). "Continuar com a Apple" fica atrás de NEXT_PUBLIC_LOGIN_APPLE_ATIVO,
 * que nasce desligada e não existe na Vercel.
 *  - Flag desligada (o laboratório de hoje): nenhum botão, texto ou chamada da Apple em /auth. O Google segue como
 *    está (o lab não o liga; a produção, sim).
 *  - Flag ligada num ambiente de teste (Preview com a variável "on" + TESTES_LOGIN_APPLE=on no runner): o botão
 *    aparece PRIMEIRO, preto, e o clique pede ao Supabase o provedor apple com volta para /auth/callback. A chamada é
 *    interceptada: nada sai para a Apple.
 * O runner diz o que espera (TESTES_LOGIN_APPLE); assim, a flag ligada por engano no lab também falha aqui.
 */
const ESPERA_LIGADA = process.env.TESTES_LOGIN_APPLE === "on";

test.describe("T471 — Login com Apple atrás da flag", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("flag desligada: /auth sem nada da Apple", async ({ page }) => {
    test.skip(ESPERA_LIGADA, "este ambiente liga a flag (TESTES_LOGIN_APPLE=on)");
    const pedidosApple: string[] = [];
    page.on("request", (r) => {
      if (/provider=apple|appleid\.apple\.com/.test(r.url())) pedidosApple.push(r.url());
    });
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/auth", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.getByTestId("login-apple")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(/Apple/);
    }
    expect(pedidosApple).toEqual([]);
  });

  test("flag ligada: o botão aparece primeiro e pede o provedor apple ao Supabase", async ({ page }) => {
    test.skip(!ESPERA_LIGADA, "flag desligada neste ambiente: o caso ligado roda com TESTES_LOGIN_APPLE=on num Preview com a variável");
    let pedido: URL | null = null;
    await page.route(/\/auth\/v1\/authorize\?/, async (rota) => {
      pedido = new URL(rota.request().url());
      await rota.fulfill({ status: 200, contentType: "text/html", body: "<p>interceptado</p>" });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    const apple = page.getByTestId("login-apple");
    await expect(apple).toBeVisible();
    await expect(apple).toHaveText("Continuar com a Apple");
    // Primeiro dos botões sociais (destaque pedido pela Apple), preto com texto branco.
    const sociais = page.getByRole("button", { name: /^Continuar com/ });
    await expect(sociais.first()).toHaveAttribute("data-testid", "login-apple");
    const cores = await apple.evaluate((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color]);
    expect(cores).toEqual(["rgb(10, 10, 10)", "rgb(255, 255, 255)"]);
    await apple.click();
    await expect.poll(() => pedido?.searchParams.get("provider") ?? null).toBe("apple");
    expect(new URL(pedido!.searchParams.get("redirect_to") ?? "").pathname).toBe("/auth/callback");
  });
});
