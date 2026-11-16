import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { noPasso } from "../fixtures/cadastro";

/** "Novo anúncio" abre o cadastro pelo passo 1 (assistente em 10 passos: o Tipo; antes, "Endereço e dados" dos 6 passos). */
test.describe("T-NOVO — Novo anúncio começa pelo passo 1 (Tipo) @criticos", () => {
  test.use({ storageState: authFile("proprietario") });

  // E744 (teste velho, ronda do Gerente de 03:20Z de 16/11/2026): o Início do dono é o do PROP-6 (#1483, 29/10) e não tem
  // mais o link "Novo anúncio" — o clique em /dashboard ficava à espera de um botão que não existe (o E817 corrigiu o
  // t288 pelo mesmo motivo). O caso de /dashboard passa a cobrar o que a tela tem hoje; "Novo anúncio" só existe em
  // Meus imóveis, e é de lá que o caminho até o passo 1 continua cobrado.
  test("no Início do dono não há 'Novo anúncio': o caminho é o botão do bloco principal (PROP-6)", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("inicio-dono-principal")).toBeVisible({ timeout: 20_000 });
    const botao = page.getByTestId("inicio-dono-botao");
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute("href", /^\/dashboard\//);
    await expect(page.getByRole("link", { name: /Novo anúncio/ })).toHaveCount(0);
  });

  for (const origem of ["/dashboard/imoveis"]) {
    test(`botão Novo anúncio em ${origem} leva ao passo 1 (Tipo)`, async ({ page }) => {
      await page.goto(origem, { waitUntil: "domcontentloaded" });
      await page.getByRole("link", { name: /Novo anúncio/ }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
      await expect(page).not.toHaveURL(/qualificar/);
      // E132-A: o cadastro novo abre na Qualificação; "Responder depois" leva ao Passo 1.
      await page.getByTestId("qualificacao-depois").click();
      await noPasso(page, "tipo");
    });
  }

  test("/qualificar sem imóvel redireciona para o cadastro (a Qualificação, E132-A)", async ({ page }) => {
    await page.goto("/qualificar", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
    await expect(page.getByTestId("qualificacao")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("qualificacao-depois").click();
    await noPasso(page, "tipo");
  });

  test("estado vazio de Meus imóveis oferece cadastrar pelas fotos", async ({ page }) => {
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const vazio = page.getByText("Comece pelas fotos do seu imóvel");
    test.skip((await vazio.count()) === 0, "conta de teste já tem imóveis");
    await page.getByRole("link", { name: "Cadastrar imóvel" }).click();
    await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
  });
});
