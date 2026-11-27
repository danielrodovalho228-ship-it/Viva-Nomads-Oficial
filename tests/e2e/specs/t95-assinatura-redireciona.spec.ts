import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T95 — Sem mensalidade (ordem 90181c57, #93): a Viva cobra só comissão.
 * /dashboard/assinatura redireciona o dono logado a /precos, e o menu do dono
 * não oferece "Plano e assinatura" nem botão de assinar em nenhuma tela visitada.
 */
test.describe("T95 — Assinatura aposentada @criticos", () => {
  test.use({ storageState: authFile("proprietario"), viewport: { width: 390, height: 844 } });

  test("/dashboard/assinatura sai de /dashboard/assinatura (para /precos ou /dashboard conforme a chave), sem plano pago à venda", async ({ page }) => {
    await page.goto("/dashboard/assinatura", { waitUntil: "domcontentloaded" });
    // next.config.ts: /precos só com NEXT_PUBLIC_PRECOS_VISIVEL=1; sem a chave (lab e produção hoje) o destino é /dashboard.
    // Decisão do chat principal (E563): preços suspensos → /dashboard; visíveis → /precos (a chave é a do build do ambiente).
    await expect(page).toHaveURL(process.env.NEXT_PUBLIC_PRECOS_VISIVEL === "1" ? /\/precos$/ : /\/dashboard$/);
    await expect(page.getByRole("button", { name: /Assinar (Essencial|Profissional)/i })).toHaveCount(0);
    await expect(page.getByText("Visualizar como plano (demonstração)")).toHaveCount(0);
  });

  // MENUS-5: o dono não tem mais menu lateral nem hambúrguer (barra de baixo no celular, abas no topo e Conta no avatar);
  // o menu lateral só existe na área da equipe. A ausência de "Plano e assinatura" vale para a página inteira, com a Conta aberta.
  for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
    test(`painel do dono a ${largura} px não tem 'Plano e assinatura' (página inteira)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      // Prova positiva: o painel carregou (conteúdo e navegação presentes) antes de afirmar a ausência.
      await expect(page.locator("[data-painel-main]")).toBeVisible();
      await expect(page.getByRole("navigation").first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Plano e assinatura/i })).toHaveCount(0);
      await expect(page.locator("a[href^='/dashboard/assinatura']")).toHaveCount(0);
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(rolagem).toBeLessThanOrEqual(1);
    });
  }
});
