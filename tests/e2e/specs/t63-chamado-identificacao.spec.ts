import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T63 — F24 (ordem f3a85544): "Abrir chamado" identifica quem pede.
 * Deslogado: nome e e-mail obrigatórios (o servidor também recusa).
 * Logado: aviso com o e-mail da conta MASCARADO e link "Alterar em Conta".
 */
test.describe("deslogado", () => {
  test("não envia sem nome/e-mail e mostra o aviso de uso dos dados", async ({ page }) => {
    await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
    await page.getByLabel("O que aconteceu?").fill("Preciso de ajuda com a Caução do meu contrato.");
    await expect(page.getByTestId("chamado-aviso-dados")).toContainText("só para responder este chamado");
    await page.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(page.getByTestId("chamado-aberto-chat")).toHaveCount(0);
    await expect(page.getByLabel("Seu nome")).toBeFocused();
  });

  test("e-mail de domínio reservado é recusado pelo servidor", async ({ page }) => {
    await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
    await page.getByLabel("O que aconteceu?").fill("Preciso de ajuda com a Caução do meu contrato.");
    await page.getByLabel("Seu nome").fill("Visitante T63");
    await page.getByLabel(/Seu e-mail/).fill("visitante@example.com");
    await page.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Não conseguimos/ })).toContainText("Não conseguimos usar este e-mail");
  });
});

test.describe("logado", () => {
  test.use({ storageState: authFile("inquilino") });
  test("mostra o e-mail da conta mascarado, nunca inteiro", async ({ page }) => {
    await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
    const aviso = page.getByTestId("chamado-email-conta");
    await expect(aviso).toContainText("Vamos responder no e-mail da sua conta");
    await expect(aviso).toContainText("***@");
    await expect(aviso.getByRole("link", { name: "Alterar em Conta" })).toBeVisible();
  });
});
