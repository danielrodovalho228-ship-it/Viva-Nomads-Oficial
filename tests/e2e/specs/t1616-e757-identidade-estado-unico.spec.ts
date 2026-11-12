import { test, expect } from "@playwright/test";

/*
  T1616 — E757 (Phoenix RELATORIO-004, C6/D1): a verificação de identidade era dita de jeitos que se contradiziam
  ("chega em breve" em /como-funciona; "A Viva confere — Identidade e CNPJ" como etapa corrente em /parceiros). Um estado
  só, igual em toda a superfície, até a Certta entrar: a verificação AUTOMÁTICA ainda não abriu; por ora, a equipe da Viva
  confere o documento. Páginas públicas, texto renderizado (sem conta).
*/
const PAGINAS = ["/como-funciona", "/parceiros", "/seguranca", "/para-proprietarios"];
const PROMESSA = /identidade[^.]{0,80}(chega|abre) em breve|abre perto do lançamento/i;

test.describe("T1616 — E757 um estado só para a verificação de identidade", () => {
  for (const rota of PAGINAS) {
    test(`${rota}: sem "chega/abre em breve" para a identidade`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      const texto = await page.locator("main").innerText({ timeout: 30_000 });
      expect(texto, `${rota} promete a verificação para depois`).not.toMatch(PROMESSA);
    });
  }

  test("/parceiros passo 2: a conferência é da equipe; a automática ainda não abriu", async ({ page }) => {
    await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
    const texto = await page.locator("main").innerText({ timeout: 30_000 });
    expect(texto).toMatch(/A equipe da Viva confere o seu documento e o CNPJ \(a verificação automática de identidade ainda não abriu\)/);
    expect(texto).not.toMatch(/A Viva confere\s+Identidade e CNPJ;/);
  });

  test("/como-funciona diz o estado único (ainda não abriu · a equipe confere)", async ({ page }) => {
    await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toContainText("A verificação automática de identidade ainda não abriu", { timeout: 30_000 });
  });
});
