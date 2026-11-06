import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1295 — E648 parte 2 (#2960, na main desde 06/11): CNPJ para TODOS os parceiros, em qualquer categoria; CPF não é aceito.
 * Entrou só com teste de unidade. Aqui é o formulário "Seja parceiro" (/parceiros), logado, a 390 e 1280 px:
 *   - a tela já diz que só trabalha com CNPJ e o campo se chama "CNPJ" (nada de escolher pessoa física);
 *   - mandar um CPF no campo é recusado com a regra ("O CPF não é aceito…"), antes de qualquer envio;
 *   - um CNPJ de números errados é recusado como "CNPJ inválido".
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `parc.t1295.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira Sobrenome", role: "tenant" as const };
const ids: { conta?: string } = {};

test.describe("T1295 — E648: parceiro só com CNPJ", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`o formulário só fala em CNPJ e recusa CPF (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), conta.email, senha);
        await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("sp-so-cnpj")).toContainText("só trabalha com parceiros que têm CNPJ", { timeout: 30_000 });
        await expect(p.getByLabel("CNPJ", { exact: true })).toBeVisible();
        await expect(p.getByLabel(/^CPF/)).toHaveCount(0);

        await p.locator("#sp-nome").fill("Paula Parceira Servicos");
        await p.locator("#sp-doc").fill(cpfAleatorio());
        await p.getByTestId("seja-parceiro-enviar").click();
        await expect(p.getByTestId("seja-parceiro-erro")).toContainText("O CPF não é aceito");

        await p.locator("#sp-doc").fill("11.222.333/0001-00");
        await p.getByTestId("seja-parceiro-enviar").click();
        await expect(p.getByTestId("seja-parceiro-erro")).toContainText("CNPJ inválido");
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
