import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * Teste #9 do "Mapa do App" (viewport de celular 390×844).
 *
 * Objetivo: REPRODUZIR o bug de modo relatado no QA antes de qualquer correção
 * (regra do revisor: provar que o problema existe na branch). Complementa o T2
 * (que cobre o lado PROPRIETÁRIO no desktop): este cobre o lado INQUILINO em
 * largura de celular, onde a sidebar desktop fica escondida — por isso lemos o
 * SELETOR segmentado (role="tablist"), não a `aside`.
 *
 * Reusa a sessão da conta `inquilino` (storageState do global-setup); o
 * `inquilino1` está no banco com `preferred_mode = tenant`.
 *
 * Comportamento DESEJADO codificado (= regra de produto nova):
 *   (A) conta inquilina ABRE em modo Inquilino;
 *   (B) o seletor alterna para Proprietário e VOLTA para Inquilino, na hora;
 *   (C) [regra nova] abrir por URL uma rota exclusiva do OUTRO modo TROCA o modo
 *       e abre a tela — NUNCA redireciona para /dashboard.
 *
 * (A) e (B) devem passar se a correção parcial da branch (resolveInitialMode +
 * ModeInitializer) já está no preview. (C) é o que o código atual NÃO faz para
 * uma conta inquilina (o guard expulsa para /dashboard, pois deriva isOwner=false)
 * — esperamos vê-lo FALHAR, isolando o tamanho exato da correção que falta.
 *
 * Asserções usam expect auto-retry para tolerar o "flash" de hidratação.
 */

test.use({ storageState: authFile("inquilino"), viewport: { width: 390, height: 844 } });

function seletor(page: Page) {
  return page.getByRole("tablist", { name: /alternar entre proprietário e inquilino/i });
}
function abaInquilino(page: Page) {
  return seletor(page).getByRole("tab", { name: /inquilino/i });
}
function abaProprietario(page: Page) {
  return seletor(page).getByRole("tab", { name: /propriet/i });
}

test.describe("T9 — modo inquilino ⇄ proprietário @criticos", () => {
  test("A — conta inquilina abre em modo Inquilino", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(seletor(page)).toBeVisible({ timeout: 15_000 });
    await expect(abaInquilino(page)).toHaveAttribute("aria-selected", "true");
  });

  test("B — seletor alterna para Proprietário e volta para Inquilino", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(seletor(page)).toBeVisible({ timeout: 15_000 });

    await abaProprietario(page).click();
    await expect(abaProprietario(page)).toHaveAttribute("aria-selected", "true");

    await abaInquilino(page).click();
    await expect(abaInquilino(page)).toHaveAttribute("aria-selected", "true");
  });

  test("C — rota exclusiva do outro modo troca o modo e NÃO redireciona", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(abaInquilino(page)).toHaveAttribute("aria-selected", "true");

    // Abre por URL uma rota exclusiva de PROPRIETÁRIO.
    await page.goto("/dashboard/imoveis");

    // Regra de produto nova: deve TROCAR para Proprietário e PERMANECER na tela.
    await expect(page).toHaveURL(/\/dashboard\/imoveis$/);
    await expect(abaProprietario(page)).toHaveAttribute("aria-selected", "true");
  });
});
