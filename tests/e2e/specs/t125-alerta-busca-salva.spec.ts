import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm } from "../fixtures/laboratorio";

/**
 * T125 — ordem cb9a09e9: alerta por e-mail de busca salva.
 *  1. Link de desligar inválido (sem assinatura): mensagem clara, página fora do Google, nada é alterado.
 *  2. Logado: em Buscas salvas o alerta vem ligado, desliga e liga de novo (e o banco acompanha).
 * O envio do e-mail em si é coberto por unitários (bate/não bate, limite de 1 por dia, preferência).
 */
test.describe("T125 — alerta de busca salva", () => {
  test("1. link de desligar sem assinatura válida não desliga nada", async ({ page }) => {
    await page.goto("/alerta-busca/desligar?b=00000000-0000-4000-8000-000000000000&t=invalido", { waitUntil: "networkidle" });
    // O Next injeta o próprio role="alert" (anunciador de rota): filtra pelo aviso da página.
    await expect(page.getByRole("alert").filter({ hasText: "não é válido" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Desligar este alerta" })).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test.describe("logado", () => {
    test.use({ storageState: authFile("inquilino") });
    test("2. Buscas salvas: alerta ligado por padrão, desliga e religa", async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto("/buscar?local=Uberl%C3%A2ndia&homeoffice=1&quartos=2", { waitUntil: "networkidle" });
      const salvar = page.getByTestId("salvar-busca").filter({ visible: true });
      // Uma execução anterior interrompida pode ter deixado a busca salva: parte sempre do estado "não salva".
      await expect(salvar).toHaveText(/Salvar busca|Busca salva/, { timeout: 10_000 });
      if ((await salvar.textContent())?.includes("Busca salva")) await salvar.click();
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });

      await page.goto("/dashboard/buscas", { waitUntil: "networkidle" });
      const botao = page.getByTestId("alerta-busca-botao").first();
      await expect(botao).toHaveText(/Alerta ligado/);
      await botao.click();
      await expect(botao).toHaveText(/Alerta desligado/, { timeout: 10_000 });
      const { data } = await adm().from("buscas_salvas").select("alerta_ativo").ilike("parametros", "%quartos=2%homeoffice=1%");
      expect((data ?? []).some((r) => r.alerta_ativo === false)).toBe(true);
      await botao.click();
      await expect(botao).toHaveText(/Alerta ligado/, { timeout: 10_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      // Limpa: remove a busca de teste pelo coração.
      await page.goto("/buscar?local=Uberl%C3%A2ndia&homeoffice=1&quartos=2", { waitUntil: "networkidle" });
      await expect(salvar).toHaveText("Busca salva", { timeout: 10_000 });
      await salvar.click();
      await expect(salvar).toHaveText("Salvar busca", { timeout: 10_000 });
    });
  });
});
