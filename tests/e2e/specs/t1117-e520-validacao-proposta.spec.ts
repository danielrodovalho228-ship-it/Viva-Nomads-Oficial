import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * T1117 — E520 (#2496, 04/11): a proposta ("Pedir para morar") não passa calada com data inválida e a confirmação
 * mostra a mensagem com o contato ocultado. Entrou só com o e520-validacao-proposta.test.ts. Pela tela real, no anúncio
 * de exemplo (ube-002, como a t225; nada é gravado), como visitante, 390 e 1280:
 *   1. entrada "31/02/2027" (não existe): o passo diz "A data de entrada está incompleta ou não existe…" e o Continuar
 *      fica desligado; apagar a data tira o erro e religa o Continuar (as datas são opcionais);
 *   2. entrada válida e saída "12/1" (incompleta): o erro da saída, com o Continuar desligado;
 *   3. mensagem "Meu zap é (34) 99999-8888": na confirmação o número não aparece e o aviso
 *      candidatura-contato-ocultado diz que telefone e e-mail foram ocultados.
 * As regras (dataDigitadaInvalida, a máscara do envio E445) ficam com o teste de unidade.
 */
const br = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const ERRO_ENTRADA = "A data de entrada está incompleta ou não existe";
const ERRO_SAIDA = "A data de saída está incompleta ou não existe";

async function abrir(page: Page): Promise<Locator> {
  await page.goto("/imoveis/ube-002", { waitUntil: "domcontentloaded" });
  const passo = page.getByTestId("solicitacao-passo");
  // Página fria: o clique pode cair antes da hidratação (como a t225) — tenta de novo até o passo abrir.
  await expect(async () => {
    await page.getByRole("button", { name: "Pedir para morar", exact: true }).locator("visible=true").first().click();
    await expect(passo).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return passo;
}

for (const largura of [390, 1280] as const) {
  test.describe(`T1117 — E520: proposta recusa data inválida e oculta o contato (${largura} px)`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });

    test("data inexistente ou incompleta trava o Continuar; a confirmação mostra a mensagem sem o telefone", async ({ page }) => {
      test.setTimeout(90_000);
      const passo = await abrir(page);
      const continuar = passo.getByRole("button", { name: "Continuar" });
      const entrada = passo.getByTestId("solicitacao-inicio");
      const saida = passo.getByTestId("solicitacao-saida");

      // 1. Entrada que não existe.
      await entrada.fill("31/02/2027");
      await expect(passo).toContainText(ERRO_ENTRADA);
      await expect(continuar).toBeDisabled();
      await entrada.fill("");
      await expect(passo).not.toContainText(ERRO_ENTRADA);
      await expect(continuar).toBeEnabled();

      // 2. Entrada válida, saída incompleta.
      await entrada.fill(br(new Date(Date.now() + 20 * 86_400_000)));
      await saida.fill("12/1");
      await expect(passo).toContainText(ERRO_SAIDA);
      await expect(continuar).toBeDisabled();
      await saida.fill("");
      await expect(passo).not.toContainText(ERRO_SAIDA);
      await expect(continuar).toBeEnabled();

      // 3. A mensagem com telefone: a confirmação mostra a versão ocultada e avisa.
      await continuar.click();
      await expect(passo.getByTestId("candidatura-apresentacao")).toBeVisible();
      await passo.getByTestId("candidatura-apresentacao").fill("Olá! Meu zap é (34) 99999-8888, me chama.");
      await passo.getByRole("button", { name: "Continuar" }).click();
      await expect(passo.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      await expect(passo.getByTestId("candidatura-contato-ocultado")).toHaveText("Telefone e e-mail foram ocultados: a conversa segue pela plataforma até o aceite.");
      await expect(passo).toContainText("Sua mensagem: Olá! Meu zap é");
      await expect(passo).not.toContainText("99999-8888");

      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
