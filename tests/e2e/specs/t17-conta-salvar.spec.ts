import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T17 — CONTA SALVA DE VERDADE. Regressão do "Salvar alterações" que não
 * chamava nada, das notificações que não gravavam e da senha atual ignorada.
 * Usa a conta de teste do inquilino e devolve os valores originais no fim.
 */
test.describe("T17 — Conta salva de verdade", () => {
  test.use({ storageState: authFile("inquilino") });

  test("nome e telefone gravam e voltam depois do F5", async ({ page }) => {
    await page.goto("/dashboard/conta/dados", { waitUntil: "networkidle" });
    const nome = page.getByLabel("Nome completo");
    const tel = page.getByLabel("Telefone");
    await expect(nome).not.toHaveValue("");
    const nomeOriginal = await nome.inputValue();
    const telOriginal = await tel.inputValue();

    await tel.fill("34 99999-0017");
    await page.getByTestId("dados-salvar").click(); // A4 (perfil-04): "Salvar"
    await expect(page.getByText("Dados salvos.")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("Telefone")).toHaveValue("(34) 99999-0017");
    await expect(page.getByLabel("Nome completo")).toHaveValue(nomeOriginal);

    // Telefone inválido: erro na tela, nada gravado.
    await page.getByLabel("Telefone").fill("123");
    await page.getByTestId("dados-salvar").click(); // A4 (perfil-04): "Salvar"
    await expect(page.getByText(/Telefone inválido/)).toBeVisible();

    // Devolve o original.
    await page.getByLabel("Telefone").fill(telOriginal);
    await page.getByTestId("dados-salvar").click(); // A4 (perfil-04): "Salvar"
    await expect(page.getByText("Dados salvos.")).toBeVisible();
  });

  test("preferência de notificação grava e volta depois do F5", async ({ page }) => {
    await page.goto("/dashboard/conta/notificacoes", { waitUntil: "networkidle" });
    // A6 (mockup perfil-06): o canal "E-mail" grava com "Salvar preferências".
    const sw = page.getByTestId("notif-canal-email");
    await expect(sw).toBeEnabled();
    const antes = await sw.getAttribute("aria-checked");
    await sw.click();
    await page.getByTestId("notif-salvar").click();
    await expect(page.getByTestId("notif-salvar-msg")).toHaveText("Preferências salvas.");
    await page.reload({ waitUntil: "networkidle" });
    const depois = page.getByTestId("notif-canal-email");
    await expect(depois).toHaveAttribute("aria-checked", antes === "true" ? "false" : "true");
    await depois.click(); // devolve
    await page.getByTestId("notif-salvar").click();
    await expect(page.getByTestId("notif-salvar-msg")).toHaveText("Preferências salvas.");
  });

  test("senha atual errada não troca a senha", async ({ page }) => {
    // Prompt 18: a troca de senha fica numa tela só (Confiança e segurança); a Conta tem só o link.
    await page.goto("/dashboard/conta/seguranca", { waitUntil: "networkidle" });
    const painel = page.locator("form").filter({ hasText: "Salvar nova senha" });
    const campos = painel.locator('input[type="password"]');
    await campos.nth(0).fill("senha-errada-de-proposito");
    await campos.nth(1).fill("NovaSenhaTeste#2026");
    await campos.nth(2).fill("NovaSenhaTeste#2026");
    await painel.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(painel.getByText("Senha atual incorreta.")).toBeVisible();
  });
});
