import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1763 — E1152 @E1152 (ORDEM-DUET-644; linha Parceiros, classe B). No pedido de credenciamento do avaliador
  (/dashboard/parceiro/avaliacao), quem punha um CPF lia a regra três vezes, com três redações: a nota fixa da tela, a
  recusa junto do campo e a lista geral. Agora a recusa é a frase da regra — a mesma do "Seja parceiro" —, a nota sai
  enquanto a recusa está lá, e a lista geral diz só o que falta.
   1. CPF no campo do CNPJ: a recusa junto do campo é a frase da regra; a nota some; a frase aparece UMA vez; a lista
      geral não repete a regra. Print a 390 e a 1280.
   2. Corrigido para um CNPJ inválido: a recusa passa a ser a do número, e a nota volta.
  Conta criada pelo spec. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const REGRA = "A Viva só trabalha com parceiros que têm CNPJ, em qualquer categoria. O CPF não é aceito: abra o seu CNPJ (MEI, onde a atividade permite) e cadastre a empresa.";
const CPF = "529.982.247-25";
const CNPJ_INVALIDO = "11.111.111/1111-11";
const senha = novaSenha();
const ids: (string | undefined)[] = [];

async function candidato(browser: import("@playwright/test").Browser, largura: number): Promise<Page> {
  const email = `e1152.t1763.${novoSufixo()}@lab.vivanomads.test`;
  ids.push(await criarConta({ email, nome: "[TESTE QA] Caio Candidato", role: "tenant" }, senha));
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("credenciamento-form").locator('form [name="nome"]')).toBeVisible({ timeout: 30_000 });
  // Espera a hidratação: antes dela, o envio é o nativo (recarrega a página) e não prova nada.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return page;
}
async function preencher(page: Page, documento: string) {
  const form = page.getByTestId("credenciamento-form").locator("form");
  const valores = { nome: "Caio Avaliações", documento, cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/portfolio" };
  for (const [n, v] of Object.entries(valores)) await form.locator(`[name="${n}"]`).fill(v);
  await form.locator('[name="aceiteConduta"]').check();
  await page.getByTestId("credenciamento-enviar").click();
}
/** Quantas vezes a frase da regra está VISÍVEL no formulário. */
const regraVisivel = (page: Page) => page.getByTestId("credenciamento-form").getByText(REGRA, { exact: true }).filter({ visible: true }).count();

test.describe("T1763 — E1152: a recusa do CPF no credenciamento é a frase da regra, uma vez só @E1152", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ timeout: 120_000 });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura}px — 1. CPF: a recusa junto do campo é a frase da regra, a nota some e a lista geral não a repete`, async ({ browser }) => {
      const page = await candidato(browser, largura);
      const painel = page.getByTestId("credenciamento-form");
      const nota = painel.getByTestId("credenciamento-so-cnpj");
      // Antes de enviar: a nota está lá, uma vez.
      await expect(nota).toBeVisible();
      await expect(nota).toHaveText(REGRA);
      expect(await regraVisivel(page)).toBe(1);

      await preencher(page, CPF);
      const recusa = page.getByTestId("campo-erro-documento");
      await expect(recusa, "a recusa é a frase da regra, da mesma fonte do formulário público").toHaveText(REGRA, { timeout: 30_000 });
      await expect(painel.locator('form [name="documento"]')).toHaveAttribute("aria-invalid", "true");
      await expect(nota, "a nota sai enquanto a recusa diz a mesma frase").toBeHidden();
      expect(await regraVisivel(page), "a frase aparece uma vez só").toBe(1);
      // A lista geral diz o que falta, sem repetir a regra do CPF com outra redação.
      const geral = painel.getByTestId("acao-erro");
      await expect(geral).toHaveText("Falta: CNPJ válido.");
      await expect(painel.getByText("CPF não é aceito: informe o CNPJ")).toHaveCount(0);
      // Nada foi limpo (E818).
      await expect(painel.locator('form [name="documento"]')).toHaveValue(CPF);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "sem rolagem lateral").toBe(true);
      await recusa.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t1763-1-cpf-${largura}.png` });
      await page.context().close();
    });
  }

  test("2. corrigido para um CNPJ inválido: a recusa é a do número e a nota volta", async ({ browser }) => {
    const page = await candidato(browser, 1280);
    const painel = page.getByTestId("credenciamento-form");
    const nota = painel.getByTestId("credenciamento-so-cnpj");
    await preencher(page, CPF);
    await expect(page.getByTestId("campo-erro-documento")).toHaveText(REGRA, { timeout: 30_000 });
    await expect(nota).toBeHidden();

    await painel.locator('form [name="documento"]').fill(CNPJ_INVALIDO);
    await page.getByTestId("credenciamento-enviar").click();
    await expect(page.getByTestId("campo-erro-documento")).toHaveText("CNPJ inválido: confira os números.", { timeout: 30_000 });
    await expect(nota, "outro erro do documento tem frase própria: a nota volta").toBeVisible();
    expect(await regraVisivel(page)).toBe(1);
    await expect(page.getByTestId("campo-erro-documento")).toHaveCount(1);
    await page.context().close();
  });
});
