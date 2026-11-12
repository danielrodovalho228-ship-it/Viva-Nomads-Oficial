import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1606 — E788 (reprova da prova ao vivo de 11/11): no topo do admin o "Equipe" era inerte (sem clique; depois sem círculo)
  e a mesma conta aparecia com iniciais diferentes por superfície ("c" no cabeçalho × "CQ" no Perfil × "C" no rodapé).
   • o selo "Equipe" do topo tem o avatar e ABRE o menu da Conta: Minha conta · Ajuda · Sair; "Minha conta" leva à Conta;
   • as iniciais do topo, do rodapé da barra lateral e do Perfil são as mesmas (maiúsculas), a 1280 e a 390 px.
*/
test.use({ storageState: hasAccount("admin") ? authFile("admin") : { cookies: [], origins: [] } });

async function letras(p: Page, seletor: string) {
  const el = p.locator(`${seletor} [data-rosto]`).first();
  await expect(el).toBeAttached({ timeout: 20_000 });
  return ((await el.textContent()) ?? "").trim();
}

test.describe("T1606 — E788 avatar da equipe funcional e iniciais iguais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");

  for (const largura of [1280, 390]) {
    test(`${largura}px — o selo Equipe abre o menu da Conta; iniciais iguais no topo, no rodapé e no Perfil`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });

      const selo = page.locator('[data-testid="papel-ativo"][data-papel="admin"]:visible');
      await expect(selo).toBeVisible({ timeout: 30_000 });
      await expect(selo).toContainText("Equipe");
      const doTopo = await letras(page, '[data-testid="papel-ativo"][data-papel="admin"]:visible');
      expect(doTopo).toMatch(/^[A-ZÀ-Ý]{1,2}$/);

      // O avatar funciona: abre o menu com os três itens; Esc fecha.
      const botao = selo.getByTestId("conta-equipe");
      await botao.click();
      const menu = page.getByTestId("menu-conta-equipe");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda", "Sair"]);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);

      // O rodapé da barra lateral (no celular, dentro da gaveta) tem as mesmas iniciais.
      if (largura === 390) await page.getByTestId("admin-abrir-menu").click();
      expect(await letras(page, '[data-testid="barra-avatar"]:visible')).toBe(doTopo);
      if (largura === 390) await page.keyboard.press("Escape");

      // "Minha conta" leva à Conta, e o Perfil mostra as mesmas iniciais.
      if (largura === 390) await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="papel-ativo"][data-papel="admin"]:visible').getByTestId("conta-equipe").click();
      await page.getByTestId("conta-equipe-conta").click();
      await expect(page).toHaveURL(/\/dashboard\/conta/, { timeout: 30_000 });
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      expect(await letras(page, "main")).toBe(doTopo);
    });
  }
});
