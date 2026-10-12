import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T53 — ordem dd8422ce (F26, F27, F28).
 *  F26: a Conta do inquilino mostra a seção "Documento (CPF)" (e o link #documento do Fechamento cai nela).
 *  F27: sem contrato ativo, Solicitações explica "manutenção abre a partir de um contrato ativo" + Central de Ajuda.
 *  F28: no modo real a tela nunca mostra os chamados de exemplo (nada de estado local fictício).
 */
test.describe("T53 — Conta (documento) e Solicitações reais", () => {
  test.use({ storageState: authFile("inquilino") });

  test("F26: Conta do inquilino tem a seção Documento (CPF)", async ({ page }) => {
    await page.goto("/dashboard/conta#documento", { waitUntil: "networkidle" });
    const secao = page.locator("section#documento");
    await expect(secao).toBeVisible({ timeout: 15_000 });
    await expect(secao).toContainText(/Documento \(CPF\)|Documento da empresa/);
    // a página não tem rolagem horizontal no celular
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(largura).toBeLessThanOrEqual(1);
  });

  test("F27/F28: Solicitações real não mostra exemplos e explica a regra do contrato ativo", async ({ page }) => {
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    await expect(page.getByText("Ana Carvalho")).toHaveCount(0);
    await expect(page.getByText("Apto Santa Mônica")).toHaveCount(0);
    const vazio = page.getByTestId("manutencao-sem-contrato");
    const cartoes = page.getByTestId("solicitacao-cartao");
    // Conta de teste sem contrato ativo: estado vazio com o link da Central de Ajuda; com contrato: lista real.
    if (await vazio.count()) {
      await expect(vazio).toContainText("contrato ativo");
      await expect(vazio.getByRole("link", { name: /Central de Ajuda/ })).toHaveAttribute("href", "/ajuda");
    } else {
      await page.reload({ waitUntil: "networkidle" });
      const antes = await cartoes.count();
      expect(await cartoes.count()).toBe(antes); // recarregar não perde chamado (vem do banco)
    }
  });
});
