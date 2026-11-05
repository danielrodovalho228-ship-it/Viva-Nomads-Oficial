import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1182 — E447 (#2692, 05/11): a categoria escolhida em /parceiros vem marcada no formulário "Quero ser parceiro". Os
 * botões "Sou fotógrafo", "Quero atender" e "Pedir parceria" ficam na MESMA página (/parceiros?categoria=…): a navegação
 * não recriava o formulário e a categoria da URL só valia na 1ª carga. Agora ela entra marcada também quando muda com a
 * página aberta, sem desmarcar o que a pessoa já escolheu. O E447 entrou só com teste de unidade; aqui é a tela, 390 e
 * 1280, com uma conta nova (sem pedido de parceria):
 *   1. "Sou fotógrafo" → a Fotografia vem marcada (sp-cat-fotografia);
 *   2. sem sair da página, "Quero atender" → a Limpeza também vem marcada, e a Fotografia SEGUE marcada;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `inq.t1182.${sufixo}@lab.vivanomads.test`, nome: "Lia Categorias", role: "tenant" as const };
const ids: { pessoa?: string } = {};

test.describe("T1182 — E447: a categoria do botão vem marcada no formulário de parceria", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.pessoa]);
  });

  for (const w of [390, 1280] as const) {
    test(`"Sou fotógrafo" marca a Fotografia; "Quero atender" soma a Limpeza (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
        await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("seja-parceiro-form")).toBeAttached({ timeout: 30_000 });

        await p.getByRole("link", { name: "Sou fotógrafo", exact: true }).first().click();
        await expect(p).toHaveURL(/categoria=fotografia/);
        await expect(p.getByTestId("sp-cat-fotografia")).toBeChecked({ timeout: 15_000 });

        await p.getByRole("link", { name: "Quero atender", exact: true }).first().click();
        await expect(p).toHaveURL(/categoria=limpeza/);
        await expect(p.getByTestId("sp-cat-limpeza")).toBeChecked({ timeout: 15_000 });
        await expect(p.getByTestId("sp-cat-fotografia"), "não desmarca o que já estava escolhido").toBeChecked();
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
