import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T2128 — E333 @E333: na Retenção do admin, o "hoje" é o dia da leitura (calendário de Brasília).
  Regra decidida (E333; unitário src/lib/minimizacao/painel.test.ts): o bloco "O que seria apagado hoje (DD/MM/AAAA)"
  leva a data do DIA EM QUE A PÁGINA É LIDA, no fuso de Brasília. A página é dinâmica (nunca sai de um cache montado no
  dia anterior), e a rodada de ontem não empresta a data dela ao título.
  A data esperada é calculada aqui, pela regra (America/Sao_Paulo), antes e depois de abrir a página: aceita qualquer
  das duas só para não falhar na virada da meia-noite. 390 e 1280 px.
*/
const diaBrasilia = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

test.describe("T2128 — E333: a Retenção diz 'O que seria apagado hoje' com a data do dia da leitura (Brasília) @E333", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (admin do laboratório com 2FA).");
  test.use({ storageState: authFile("admin") });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — o título do bloco de hoje leva a data de hoje em Brasília`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const antes = diaBrasilia();
      await page.goto("/admin/retencao", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Dados e retenção" })).toBeVisible({ timeout: 30_000 });
      const depois = diaBrasilia();
      const bloco = page.locator("#hoje");
      await expect(bloco).toBeVisible();
      const titulo = (await bloco.getByText(/^O que seria apagado hoje \(\d{2}\/\d{2}\/\d{4}\)$/).first().innerText()).trim();
      const data = titulo.match(/\((\d{2}\/\d{2}\/\d{4})\)/)![1];
      expect([antes, depois], `título "${titulo}": a data é a do dia da leitura em Brasília`).toContain(data);

      // Recarregada, a página volta a calcular (dinâmica): a mesma data do dia.
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#hoje").getByText(`O que seria apagado hoje (${data})`)).toBeVisible({ timeout: 30_000 });
    });
  }
});
