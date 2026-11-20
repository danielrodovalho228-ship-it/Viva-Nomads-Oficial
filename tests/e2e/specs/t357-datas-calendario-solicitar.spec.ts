import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/** E136: no computador o campo de data mostra dd/mm/aaaa (o calendário é o do site, em pt-BR). */
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/**
 * T357 — E53 (onda de testes 1B, 23/10, walk no UBE-001): as datas escolhidas no calendário chegam ao "Solicitar".
 *   1. o morador escolhe entrada e saída (30 dias) no calendário de Disponibilidade → a caixa de reserva já mostra as
 *      duas datas e, ao tocar em "Solicitar", o Revisar abre com entrada, saída (30 dias), pessoas e o total da estadia
 *      — nada de "A combinar com o proprietário";
 *   2. alterar a saída e as pessoas no diálogo recalcula o total e volta para a caixa e para o calendário (uma fonte só).
 * E694 (resíduo): o exemplo não tem mais "Pedir para morar"; a prova usa um anúncio REAL criado no laboratório. Prints 1280 e 390.
 */
const SAIDA = "tests/laboratorio/saida";

// E694 (resíduo): o anúncio de exemplo não oferece mais "Pedir para morar"; o fluxo de candidatura é de anúncio REAL, criado aqui.
const senhaDono = novaSenha();
const dono = { email: `dono.t357.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Candidatura", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.dono = await criarConta(dono, senhaDono);
  ids.imovel = await criarImovelPronto(ids.dono, "Studio candidatura t357", { ativo: true, preco: 2800 });
});
test.afterAll(async () => {
  if (NO_LABORATORIO) await apagarContas([ids.dono]);
});

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
    test.skip(!NO_LABORATORIO, "Só no laboratório (anúncio real).");

    test("datas do calendário chegam preenchidas ao Solicitar; alterar no diálogo recalcula o total e volta à caixa", async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });

      const { entrada, saida } = await escolherNoCalendario(page, 30);
      // A caixa de reserva já é a mesma seleção.
      const card = page.locator("#cartao-preco");
      await expect(card.getByTestId("candidatura-inicio")).toHaveValue(dataBR(entrada));
      await expect(card.getByTestId("candidatura-saida")).toHaveValue(dataBR(saida));
      await card.getByTestId("candidatura-pessoas").selectOption("2");

      const gatilho = largura >= 1024 ? card : page.getByTestId("barra-fixa-imovel");
      await gatilho.getByRole("button", { name: "Pedir para morar", exact: true }).click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      await expect(passo.getByTestId("solicitacao-inicio")).toHaveValue(dataBR(entrada));
      await expect(passo.getByTestId("solicitacao-saida")).toHaveValue(dataBR(saida));
      await expect(passo.getByTestId("solicitacao-pessoas")).toHaveValue("2");
      await expect(passo).not.toContainText("A combinar com o proprietário");
      // E562 (telas): o total vem em DIAS exatos, com o rótulo "Total da estadia (N dias)".
      const totalEstadia = passo.locator("div", { hasText: /^Total da estadia \(/ }).first();
      await expect(totalEstadia).toContainText("Total da estadia (30 dias)");
      await expect(totalEstadia).toContainText("1 mês");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t357-solicitar-preenchido-${nome}.png` });

      // Alterar no diálogo: saída +30 dias → o total da estadia passa a 2 meses (o anúncio do laboratório aceita até 2 pessoas).
      const novaSaida = maisDias(saida, 30);
      await passo.getByTestId("solicitacao-saida").fill(novaSaida);
      await expect(totalEstadia).toContainText("Total da estadia (60 dias)");
      await expect(totalEstadia).toContainText("2 meses");
      await expect(passo.locator("div", { hasText: /^Total por mês \(com contas\)/ }).first()).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t357-solicitar-alterado-${nome}.png` });

      // E562: 43 dias = "1 mês + 13 dias" — sem arredondar para 2 meses.
      await passo.getByTestId("solicitacao-saida").fill(maisDias(entrada, 43));
      await expect(totalEstadia).toContainText("Total da estadia (43 dias)");
      await expect(totalEstadia).toContainText("1 mês + 13 dias");
      await expect(totalEstadia).not.toContainText("meses");
      await passo.getByTestId("solicitacao-saida").fill(novaSaida);

      // Saída antes da entrada: erro visível e "Continuar" travado (nada some calado).
      await passo.getByTestId("solicitacao-saida").fill(maisDias(entrada, -1));
      await expect(passo.getByTestId("solicitacao-erro")).toContainText("saída precisa ser depois da entrada");
      await expect(passo.getByRole("button", { name: "Continuar" })).toBeDisabled();
      await passo.getByTestId("solicitacao-saida").fill(novaSaida);
      await expect(passo.getByTestId("solicitacao-erro")).toHaveCount(0);

      // Fechar: a caixa e o calendário mostram o que mudou no diálogo.
      await passo.getByRole("button", { name: "Cancelar" }).click(); // anúncio real: o 1º passo fecha por "Cancelar"
      await expect(passo).toHaveCount(0);
      await expect(card.getByTestId("candidatura-saida")).toHaveValue(dataBR(novaSaida));
      await expect(card.getByTestId("candidatura-pessoas")).toHaveValue("2");
      await expect(page.getByTestId("calendario-selecao")).toContainText(`${br(entrada)} → ${br(novaSaida)}`);
    });
  });
}
