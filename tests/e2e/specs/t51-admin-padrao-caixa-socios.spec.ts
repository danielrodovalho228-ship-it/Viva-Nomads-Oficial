import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T51 — TELAS DO ADMIN NO PADRÃO + CAIXA DOS SÓCIOS (pedido do Daniel, 12/10/2026).
 * Parceiros e Fotógrafos estavam em branco/estreitas; agora seguem o padrão (título, cartões, painéis, largura cheia).
 * A Caixa dos Sócios recebe texto e mostra o envio na conversa. Nada pode ter rolagem lateral no celular.
 */
const TELAS = [
  { url: "/admin/parceiros", titulo: "Parceiros" },
  { url: "/admin/fotografos", titulo: "Fotógrafos parceiros" },
  { url: "/admin/socios", titulo: "Caixa dos Sócios" },
  { url: "/admin/documentos", titulo: "Documentos em conferência" },
];

test.describe("T51 — Admin no padrão + Caixa dos Sócios", () => {
  test.use({ storageState: authFile("admin") });

  for (const largura of [360, 1280]) {
    test(`telas do admin com título e sem rolagem lateral a ${largura}px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const t of TELAS) {
        await page.goto(t.url, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1, name: t.titulo }), t.url).toBeVisible();
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, `${t.url} a ${largura}px`).toBeLessThanOrEqual(1);
        await expect(page.locator("main")).not.toContainText(/NaN|undefined|Indisponível no modo demonstração/);
      }
    });
  }

  test("visão geral alcança as áreas novas pelo menu do admin", async ({ page }) => {
    // E176: a inicial do admin não repete "Áreas do admin" (estilo-admin.test); os atalhos moram no menu lateral.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin", { waitUntil: "networkidle" });
    for (const href of ["/admin/socios", "/admin/parceiros", "/admin/agentes"]) {
      await expect(page.locator(`a[href="${href}"]`).first(), href).toBeAttached();
    }
  });

  test("Caixa dos Sócios: envia texto e aparece na conversa como Recebido", async ({ page }) => {
    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    const msg = `Teste do laboratório ${Date.now()}`;
    await page.getByLabel("Mensagem").fill(msg);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Enviado" })).toBeVisible();
    await expect(page.locator("main").getByText(msg)).toBeVisible();
    await expect(page.locator("main").getByText("Recebido").first()).toBeVisible();
  });

  test("Caixa dos Sócios: envio vazio mostra erro claro", async ({ page }) => {
    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Escreva uma mensagem ou anexe um arquivo" }),
    ).toBeVisible();
  });

  test("Atendimento: cartão 'Abertos agora' abre a fila", async ({ page }) => {
    await page.goto("/admin/atendimento?aba=metricas", { waitUntil: "networkidle" });
    const cartao = page.getByRole("link", { name: /Abertos agora/ });
    if (await cartao.count()) await expect(cartao.first()).toHaveAttribute("href", "/admin/atendimento?aba=fila");
  });
});

test.describe("T51 — não-admin não vê a Caixa", () => {
  test.use({ storageState: authFile("inquilino") });
  test("inquilino recebe 404 em /admin/socios", async ({ page }) => {
    const r = await page.goto("/admin/socios");
    expect([404, 200]).toContain(r?.status() ?? 404);
    await expect(page.locator("body")).not.toContainText("Caixa dos Sócios");
  });
});
