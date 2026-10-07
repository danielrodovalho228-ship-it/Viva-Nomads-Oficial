import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { account } from "../fixtures/accounts";

/**
 * T4 — FRONTEIRA DEMO/REAL (@criticos) — regressão do vazamento.
 * Conta REAL (não-admin, demo desligado) NUNCA vê dado fictício. Conta admin com
 * demo LIGADO vê os exemplos, mas sempre com o banner de demonstração.
 */

const PERSONAS_DEMO = /Ana Carvalho|CTR-2026|VN-CT-2026/;

test.describe("T4 — Conta real, demo desligado @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  test("Fechamento não expõe persona/contrato fictício", async ({ page }) => {
    await page.goto("/dashboard/fechamento", { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText(PERSONAS_DEMO);
  });

  test("saudação/sidebar exibem o nome REAL da conta", async ({ page }) => {
    const nome = account("proprietario").nome;
    test.skip(!nome, "Defina TESTES_PROPRIETARIO_NOME para conferir o nome real.");
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const primeiro = nome.split(" ")[0];
    await expect(page.locator("body")).toContainText(primeiro);
    await expect(page.locator("aside")).toContainText(primeiro);
    // E nunca a persona de demonstração.
    await expect(page.locator("aside")).not.toContainText(/Marcos Andrade/);
  });

  test("verificação mostra 'Não verificado' — sem selo automático", async ({ page }) => {
    await page.goto("/dashboard/verificacao", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/Não verificado/i);
    await expect(page.locator("body")).not.toContainText(/Verificação de demonstração/i);
  });
});

/**
 * O modo demonstração só EXISTE com NEXT_PUBLIC_MODO_DEMO_PAINEL=1 (preview
 * para apresentações). Sem a flag — produção e laboratório — o ?demo=1 tem de
 * ser ignorado até para o admin. Com a flag, o exemplo aparece sempre com o
 * aviso de demonstração. (A tela de Fechamento não tem mais dados de exemplo;
 * a de Contratos ainda tem.)
 */
const DEMO_LIGADO_NO_AMBIENTE = process.env.NEXT_PUBLIC_MODO_DEMO_PAINEL === "1";

test.describe("T4 — Conta admin e o ?demo=1 @criticos", () => {
  test.use({ storageState: authFile("admin") });

  test("sem a flag do ambiente, ?demo=1 é ignorado: nada fictício, nenhum aviso", async ({ page }) => {
    test.skip(DEMO_LIGADO_NO_AMBIENTE, "Ambiente com modo demonstração ligado");
    await page.goto("/dashboard/contratos?demo=1", { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText(PERSONAS_DEMO);
    await expect(page.locator("body")).not.toContainText(/Modo demonstração · dados fictícios/i);
  });

  test("com a flag, os exemplos aparecem COM o aviso de demonstração", async ({ page }) => {
    test.skip(!DEMO_LIGADO_NO_AMBIENTE, "Modo demonstração desligado neste ambiente (NEXT_PUBLIC_MODO_DEMO_PAINEL)");
    await page.goto("/dashboard/contratos?demo=1", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(/dados fictícios|Modo demonstração/i);
    await expect(page.locator("body")).toContainText(PERSONAS_DEMO);
  });
});
