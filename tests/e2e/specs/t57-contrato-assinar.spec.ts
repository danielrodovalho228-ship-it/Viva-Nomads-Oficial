import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T57 — ordem 0fd301f0 (F40): o inquilino abre o contrato pelo título/botão e vê o que falta para assinar.
 * O fluxo completo "as duas partes assinam" precisa de um contrato semeado nas contas de teste; sem ele,
 * a parte que depende de contrato é pulada (fica registrado no relatório do lab), e as recusas sempre rodam.
 */
test.describe("T57 — Contrato: ver e assinar", () => {
  test.use({ storageState: authFile("inquilino") });

  // Um teste por rota, sem esperar "networkidle" (o painel mantém conexões abertas e o conjunto de 4 idas
  // estourava os 45 s do teste). O status 404 vem na resposta; se o painel já tiver enviado o esqueleto de
  // carregamento, a prova é a tela "Página não encontrada" sem nenhum dado de contrato.
  const rotasSemAcesso = [
    ["locações: uuid que não existe", "/dashboard/locacoes/00000000-0000-4000-8000-000000000000"],
    ["locações: id que não é uuid", "/dashboard/locacoes/nao-e-uuid"],
    // Rota do proprietário (ordem f375fdc1): mesma regra.
    ["contratos: uuid que não existe", "/dashboard/contratos/00000000-0000-4000-8000-000000000000"],
    ["contratos: id que não é uuid", "/dashboard/contratos/nao-e-uuid"],
  ] as const;
  for (const [nome, rota] of rotasSemAcesso) {
    test(`contrato que não existe ou que não é meu dá 404 e nada vaza — ${nome}`, async ({ page }) => {
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      if (r?.status() !== 404) {
        await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
      }
      await expect(page.getByTestId("contrato-resumo")).toHaveCount(0);
      await expect(page.getByTestId("form-assinar")).toHaveCount(0);
    });
  }

  test("Minhas locações: título e botão abrem o detalhe; assinar exige 'Li e concordo' e o código de e-mail", async ({ page }) => {
    await page.goto("/dashboard/locacoes", { waitUntil: "networkidle" });
    const titulo = page.getByTestId("locacao-titulo").first();
    test.skip((await titulo.count()) === 0, "conta de teste sem contrato semeado");
    await expect(page.getByTestId("locacao-ver-contrato").first()).toBeVisible();
    await titulo.click();
    await expect(page).toHaveURL(/\/dashboard\/locacoes\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("contrato-resumo")).toContainText("MINUTA DE TESTE — sem validade");
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
    const form = page.getByTestId("form-assinar");
    if (await form.count()) {
      await expect(page.getByTestId("assinar-enviar")).toBeDisabled();
      await page.getByTestId("assinar-aceite").check();
      await expect(page.getByTestId("assinar-enviar")).toBeDisabled(); // falta o código de 6 dígitos
      await page.getByTestId("assinar-codigo").fill("123456");
      await expect(page.getByTestId("assinar-enviar")).toBeEnabled(); // o servidor recusa código que não foi pedido
    }
  });
});

test.describe("T57 — Contrato: proprietário abre e assina (ordem f375fdc1)", () => {
  test.use({ storageState: authFile("proprietario") });

  test("'Ver e assinar contrato' abre /dashboard/contratos/<id> com o resumo e o aviso", async ({ page }) => {
    await page.goto("/dashboard/contratos", { waitUntil: "networkidle" });
    const link = page.getByTestId("contrato-ver-assinar").first();
    test.skip((await link.count()) === 0, "conta de teste sem contrato semeado");
    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("contrato-resumo")).toBeVisible();
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
  });
});
