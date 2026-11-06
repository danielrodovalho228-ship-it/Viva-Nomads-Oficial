import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1257 — E362 (#2920) e E372 (#2926), 06/11. Os dois entraram só com teste de unidade que lê o código-fonte; aqui é a tela.
 *   E362 — o "Como funciona" de /parceiros só promete conferir o que o pedido pede: "Identidade e CPF ou CNPJ; para
 *          fotografia, também o portfólio." (sem a frase antiga "Identidade, CPF ou CNPJ e portfólio" para todo parceiro).
 *   E372 — "Meus dados" (/dashboard/conta/dados): o documento (CPF/CNPJ) é só mostrado, nunca pedido ali ("Informar CPF" saiu), e o
 *          botão de salvar só destrava depois que os dados gravados chegaram (o telefone nasce travado em "Carregando…").
 * 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `conta.t1257.${sufixo}@lab.vivanomads.test`, nome: "Clara Conta", role: "tenant" as const };
const ids: { conta?: string } = {};

test.describe("T1257 — E362 (portfólio só em fotografia) e E372 (Meus dados)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`E362: /parceiros não promete portfólio para todo parceiro (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await ctx.newPage();
        await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
        const corpo = p.locator("main");
        await expect(corpo).toContainText("Identidade e CPF ou CNPJ; para fotografia, também o portfólio.", { timeout: 30_000 });
        await expect(corpo).not.toContainText("Identidade, CPF ou CNPJ e portfólio");
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });

    test(`E372: Meus dados mostra o documento sem pedir de novo e só salva com os dados carregados (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), conta.email, senha);
        await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
        const salvar = p.getByTestId("dados-salvar");
        await expect(salvar).toBeVisible({ timeout: 30_000 });
        // Os dados gravados chegaram: o salvar destrava.
        await expect(salvar).toBeEnabled({ timeout: 30_000 });
        // O documento só é mostrado ali (somente leitura) e a tela não manda "Informar CPF/CNPJ".
        await expect(p.getByTestId("dados-documento")).toHaveJSProperty("readOnly", true);
        await expect(p.locator("main")).not.toContainText(/Informar (CPF|CNPJ)/);
        // Quando o documento falta, o caminho é o bloco Documento, abaixo (nunca um segundo pedido).
        const aviso = p.getByTestId("dados-documento-aviso");
        if (await aviso.count()) await expect(aviso).toContainText("bloco Documento, abaixo");
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
