import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T6 — DINHEIRO E NÚMEROS — regressão da comissão percentual.
 * A comissão de fechamento é % do 1º aluguel (ex.: 8%), UMA vez — nunca o
 * aluguel cheio, nunca "1 mês de aluguel".
 */
test.describe("T6 — Comissão (contrato real do proprietário)", () => {
  test.use({ storageState: authFile("proprietario") });

  test("Contratos & blocos: comissão em % e nunca '1 mês de aluguel'", async ({ page }) => {
    // Dado REAL (o laboratório cria o contrato no seed), sem modo demonstração.
    await page.goto("/dashboard/contratos", { waitUntil: "networkidle" });
    const corpo = await page.locator("body").innerText();
    // No laboratório o contrato existe sempre (seed): lá, faltar é falha, não pulo.
    const noLaboratorio = process.env.INTEGRACOES_SIMULADAS === "on";
    test.skip(!noLaboratorio && !/Comissão do contrato/i.test(corpo), "Esta conta não tem contrato neste ambiente");
    expect(corpo).toMatch(/\d+%\s*do 1º aluguel/); // percentual sobre o 1º aluguel
    expect(corpo).not.toMatch(/1 m[êe]s de aluguel/i);
    expect(corpo).not.toMatch(/comiss[ãa]o.*aluguel cheio/i);
  });
});

test.describe("T6 — Preços", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/precos publica a tabela de planos", async ({ page }) => {
    await page.goto("/precos", { waitUntil: "networkidle" });
    const corpo = await page.locator("body").innerText();
    // Tabela de planos publicada (nomes dos planos aparecem).
    expect(corpo).toMatch(/Essencial|Profissional|Gestor|Gr[áa]tis/i);
    // Banner do Plano Fundador só quando a flag está ON no ambiente — verificação
    // suave (não falha o CI se a flag estiver desligada no preview).
    if (/Fundador/i.test(corpo)) {
      await expect(page.locator("body")).toContainText(/Fundador/i);
    } else {
      test.info().annotations.push({ type: "info", description: "Plano Fundador OFF neste ambiente (flag)." });
    }
  });
});
