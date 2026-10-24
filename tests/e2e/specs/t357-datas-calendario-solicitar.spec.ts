import { test, expect, type Page } from "@playwright/test";

/**
 * T357 — E53 (onda de testes 1B, 23/10, walk no UBE-001): as datas escolhidas no calendário chegam ao "Solicitar".
 *   1. o morador escolhe entrada e saída (30 dias) no calendário de Disponibilidade → a caixa de reserva já mostra as
 *      duas datas e, ao tocar em "Solicitar", o Revisar abre com entrada, saída (30 dias), pessoas e o total da estadia
 *      — nada de "A combinar com o proprietário";
 *   2. alterar a saída e as pessoas no diálogo recalcula o total e volta para a caixa e para o calendário (uma fonte só).
 * Vale para o anúncio de exemplo (aqui, ube-001) e para o real (o mesmo componente). Prints 1280 e 390.
 */
const SAIDA = "tests/laboratorio/saida";

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

async function escolherNoCalendario(page: Page, dias: number) {
  const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
  await expect(livres.first()).toBeVisible({ timeout: 20_000 });
  // Uma entrada com pelo menos `dias` livres depois dela dentro dos 3 meses do calendário.
  const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  const livresSet = new Set(todos);
  const entrada = todos.find((d) => livresSet.has(maisDias(d, dias)));
  expect(entrada, "precisa haver um período livre no calendário").toBeTruthy();
  const saida = maisDias(entrada!, dias);
  await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
  await page.locator(`#disponibilidade button[data-dia="${saida}"]`).click();
  await expect(page.getByTestId("calendario-selecao")).toContainText(`${br(entrada!)} → ${br(saida)}`);
  return { entrada: entrada!, saida };
}

for (const [nome, largura, altura] of [["1280", 1280, 900], ["390", 390, 844]] as const) {
  test.describe(`T357 — E53: calendário → Solicitar (${nome} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("datas do calendário chegam preenchidas ao Solicitar; alterar no diálogo recalcula o total e volta à caixa", async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });

      const { entrada, saida } = await escolherNoCalendario(page, 30);
      // A caixa de reserva já é a mesma seleção.
      const card = page.locator("#cartao-preco");
      await expect(card.getByTestId("candidatura-inicio")).toHaveValue(entrada);
      await expect(card.getByTestId("candidatura-saida")).toHaveValue(saida);
      await card.getByTestId("candidatura-pessoas").selectOption("2");

      const gatilho = largura >= 1024 ? card : page.getByTestId("barra-fixa-imovel");
      await gatilho.getByRole("button", { name: "Solicitar", exact: true }).click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      await expect(passo.getByTestId("solicitacao-inicio")).toHaveValue(entrada);
      await expect(passo.getByTestId("solicitacao-saida")).toHaveValue(saida);
      await expect(passo.getByTestId("solicitacao-pessoas")).toHaveValue("2");
      await expect(passo).not.toContainText("A combinar com o proprietário");
      const totalEstadia = passo.locator("div", { hasText: /^Total da estadia/ }).first();
      await expect(totalEstadia).toContainText("em 1 mês");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t357-solicitar-preenchido-${nome}.png` });

      // Alterar no diálogo: saída +30 dias e 3 pessoas → o total da estadia passa a 2 meses.
      const novaSaida = maisDias(saida, 30);
      await passo.getByTestId("solicitacao-saida").fill(novaSaida);
      await passo.getByTestId("solicitacao-pessoas").selectOption("3");
      await expect(totalEstadia).toContainText("em 2 meses");
      await expect(passo.locator("div", { hasText: /^Total por mês/ }).first()).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t357-solicitar-alterado-${nome}.png` });

      // Saída antes da entrada: erro visível e "Continuar" travado (nada some calado).
      await passo.getByTestId("solicitacao-saida").fill(maisDias(entrada, -1));
      await expect(passo.getByTestId("solicitacao-erro")).toContainText("saída precisa ser depois da entrada");
      await expect(passo.getByRole("button", { name: "Continuar" })).toBeDisabled();
      await passo.getByTestId("solicitacao-saida").fill(novaSaida);
      await expect(passo.getByTestId("solicitacao-erro")).toHaveCount(0);

      // Fechar: a caixa e o calendário mostram o que mudou no diálogo.
      await passo.getByRole("button", { name: "Entendi" }).click();
      await expect(passo).toHaveCount(0);
      await expect(card.getByTestId("candidatura-saida")).toHaveValue(novaSaida);
      await expect(card.getByTestId("candidatura-pessoas")).toHaveValue("3");
      await expect(page.getByTestId("calendario-selecao")).toContainText(`${br(entrada)} → ${br(novaSaida)}`);
    });
  });
}
